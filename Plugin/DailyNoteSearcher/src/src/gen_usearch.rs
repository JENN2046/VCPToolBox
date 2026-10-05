use rusqlite::{params, Connection, OptionalExtension, Transaction, TransactionBehavior};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;
use std::error::Error;
use std::fmt;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

pub const SCHEMA_VERSION: i64 = 1;

#[derive(Debug)]
pub enum GenIndexError {
    Sqlite(rusqlite::Error),
    Io(std::io::Error),
    Invariant(String),
    Conflict(String),
    Exhausted(&'static str),
    NotFound(String),
}

impl fmt::Display for GenIndexError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Sqlite(error) => write!(f, "sqlite error: {error}"),
            Self::Io(error) => write!(f, "io error: {error}"),
            Self::Invariant(message) => write!(f, "invariant violation: {message}"),
            Self::Conflict(message) => write!(f, "conflict: {message}"),
            Self::Exhausted(name) => write!(f, "{name} exhausted"),
            Self::NotFound(name) => write!(f, "not found: {name}"),
        }
    }
}

impl Error for GenIndexError {}

impl From<rusqlite::Error> for GenIndexError {
    fn from(value: rusqlite::Error) -> Self {
        Self::Sqlite(value)
    }
}

impl From<std::io::Error> for GenIndexError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

pub type Result<T> = std::result::Result<T, GenIndexError>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RuntimeLease {
    pub owner_id: String,
    pub fence: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceRecord {
    pub doc_id: String,
    pub active_uri: String,
    pub document_state: String,
    pub source_presence: String,
    pub observed_source_revision: Option<String>,
    pub observed_source_digest: Option<String>,
    pub reconcile_target_revision: Option<String>,
    pub reconciliation_state: String,
    pub index_state: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionRecord {
    pub version_id: String,
    pub chunk_id: String,
    pub vector_id: Option<i64>,
    pub state: String,
    pub created_visibility_seq: Option<i64>,
    pub retired_visibility_seq: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecoveryRecord {
    pub vector_id: i64,
    pub state: String,
    pub covered_segment_id: Option<String>,
    pub has_exact_vector_bytes: bool,
}

pub struct MetadataStore {
    conn: Connection,
    path: PathBuf,
}

impl MetadataStore {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&path)?;
        conn.busy_timeout(Duration::from_secs(5))?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let journal_mode: String =
            conn.query_row("PRAGMA journal_mode=WAL", [], |row| row.get(0))?;
        if !journal_mode.eq_ignore_ascii_case("wal") {
            return Err(GenIndexError::Invariant(format!(
                "UNSUPPORTED_DURABILITY_PROFILE: journal_mode={journal_mode}"
            )));
        }
        conn.pragma_update(None, "synchronous", "FULL")?;
        conn.pragma_update(None, "wal_autocheckpoint", 1000_i64)?;

        let mut store = Self { conn, path };
        store.initialize_schema()?;
        store.verify_durability_profile()?;
        Ok(store)
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    fn initialize_schema(&mut self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS gen_global_state (
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
                schema_version INTEGER NOT NULL,
                visibility_seq INTEGER NOT NULL CHECK (visibility_seq >= 0),
                manifest_epoch INTEGER NOT NULL CHECK (manifest_epoch >= 0),
                vector_high_water INTEGER NOT NULL CHECK (vector_high_water >= 0),
                runtime_fence_high_water INTEGER NOT NULL CHECK (runtime_fence_high_water >= 0)
            );

            INSERT OR IGNORE INTO gen_global_state(
                singleton, schema_version, visibility_seq, manifest_epoch,
                vector_high_water, runtime_fence_high_water
            ) VALUES (1, 1, 0, 0, 0, 0);

            CREATE TABLE IF NOT EXISTS documents (
                doc_id TEXT PRIMARY KEY,
                active_uri TEXT NOT NULL UNIQUE,
                document_state TEXT NOT NULL CHECK (document_state IN ('ACTIVE', 'DELETED')),
                source_presence TEXT NOT NULL CHECK (source_presence IN ('PRESENT', 'MISSING')),
                observed_source_revision TEXT,
                observed_source_digest TEXT,
                reconcile_target_revision TEXT,
                reconciliation_state TEXT NOT NULL
                    CHECK (reconciliation_state IN ('PENDING', 'ADMITTED', 'COMPLETE', 'ERROR')),
                index_state TEXT NOT NULL
                    CHECK (index_state IN ('CURRENT', 'INDEX_LAGGING', 'INDEX_ERROR')),
                updated_at_ms INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS document_uri_history (
                doc_id TEXT NOT NULL,
                uri TEXT NOT NULL,
                first_seen_ms INTEGER NOT NULL,
                last_seen_ms INTEGER NOT NULL,
                is_active INTEGER NOT NULL CHECK (is_active IN (0, 1)),
                PRIMARY KEY (doc_id, uri),
                FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS chunk_heads (
                chunk_id TEXT PRIMARY KEY,
                doc_id TEXT NOT NULL,
                current_version_id TEXT,
                logical_slot INTEGER,
                updated_at_ms INTEGER NOT NULL,
                FOREIGN KEY (doc_id) REFERENCES documents(doc_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS chunk_versions (
                version_id TEXT PRIMARY KEY,
                chunk_id TEXT NOT NULL,
                vector_id INTEGER UNIQUE CHECK (vector_id IS NULL OR vector_id > 0),
                state TEXT NOT NULL CHECK (
                    state IN (
                        'PREPARED', 'EMBEDDING', 'VECTOR_STAGED',
                        'ACTIVE', 'RETIRED', 'ABORTED', 'GC_ELIGIBLE'
                    )
                ),
                content_sha256 TEXT NOT NULL,
                embedding_fingerprint TEXT,
                created_visibility_seq INTEGER,
                retired_visibility_seq INTEGER,
                created_at_ms INTEGER NOT NULL,
                FOREIGN KEY (chunk_id) REFERENCES chunk_heads(chunk_id) ON DELETE CASCADE
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_chunk_versions_one_active
            ON chunk_versions(chunk_id)
            WHERE state = 'ACTIVE';

            CREATE TABLE IF NOT EXISTS vector_recovery (
                vector_id INTEGER PRIMARY KEY CHECK (vector_id > 0),
                state TEXT NOT NULL CHECK (
                    state IN (
                        'RECOVERY_REQUIRED', 'SEGMENT_COVERED',
                        'RECOVERY_RECLAIMABLE', 'RECOVERY_RELEASED'
                    )
                ),
                exact_vector_bytes BLOB,
                embedding_fingerprint TEXT NOT NULL,
                covered_segment_id TEXT,
                updated_at_ms INTEGER NOT NULL,
                FOREIGN KEY (vector_id) REFERENCES chunk_versions(vector_id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS segments (
                segment_id TEXT PRIMARY KEY,
                state TEXT NOT NULL CHECK (
                    state IN (
                        'BUILDING', 'FINALIZED_DURABLE',
                        'PUBLISHED', 'RETIRED', 'RECLAIMABLE'
                    )
                ),
                artifact_path TEXT NOT NULL,
                artifact_digest TEXT NOT NULL,
                embedding_fingerprint TEXT NOT NULL,
                artifact_verified INTEGER NOT NULL CHECK (artifact_verified IN (0, 1)),
                final_name_durable INTEGER NOT NULL CHECK (final_name_durable IN (0, 1)),
                published_manifest_epoch INTEGER,
                created_at_ms INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS segment_vectors (
                segment_id TEXT NOT NULL,
                vector_id INTEGER NOT NULL CHECK (vector_id > 0),
                PRIMARY KEY (segment_id, vector_id),
                FOREIGN KEY (segment_id) REFERENCES segments(segment_id) ON DELETE CASCADE,
                FOREIGN KEY (vector_id) REFERENCES chunk_versions(vector_id)
            );

            CREATE TABLE IF NOT EXISTS manifest_epochs (
                manifest_epoch INTEGER PRIMARY KEY CHECK (manifest_epoch >= 0),
                previous_epoch INTEGER,
                embedding_fingerprint TEXT,
                published_at_ms INTEGER NOT NULL
            );

            INSERT OR IGNORE INTO manifest_epochs(
                manifest_epoch, previous_epoch, embedding_fingerprint, published_at_ms
            ) VALUES (0, NULL, NULL, 0);

            CREATE TABLE IF NOT EXISTS manifest_segments (
                manifest_epoch INTEGER NOT NULL,
                segment_id TEXT NOT NULL,
                PRIMARY KEY (manifest_epoch, segment_id),
                FOREIGN KEY (manifest_epoch) REFERENCES manifest_epochs(manifest_epoch) ON DELETE CASCADE,
                FOREIGN KEY (segment_id) REFERENCES segments(segment_id)
            );

            CREATE TABLE IF NOT EXISTS runtime_ownership (
                singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
                owner_id TEXT,
                fence INTEGER NOT NULL CHECK (fence >= 0),
                state TEXT NOT NULL CHECK (state IN ('UNOWNED', 'SERVING', 'DRAINING')),
                acquired_at_ms INTEGER
            );

            INSERT OR IGNORE INTO runtime_ownership(
                singleton, owner_id, fence, state, acquired_at_ms
            ) VALUES (1, NULL, 0, 'UNOWNED', NULL);
            "#,
        )?;

        let schema_version: i64 = self.conn.query_row(
            "SELECT schema_version FROM gen_global_state WHERE singleton = 1",
            [],
            |row| row.get(0),
        )?;
        if schema_version != SCHEMA_VERSION {
            return Err(GenIndexError::Invariant(format!(
                "schema version mismatch: expected={SCHEMA_VERSION}, actual={schema_version}"
            )));
        }
        Ok(())
    }

    pub fn verify_durability_profile(&self) -> Result<()> {
        let journal_mode: String = self
            .conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))?;
        let synchronous: i64 = self
            .conn
            .query_row("PRAGMA synchronous", [], |row| row.get(0))?;
        let foreign_keys: i64 = self
            .conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))?;

        if !journal_mode.eq_ignore_ascii_case("wal") || synchronous < 2 || foreign_keys != 1 {
            return Err(GenIndexError::Invariant(format!(
                "UNSUPPORTED_DURABILITY_PROFILE: journal_mode={journal_mode}, synchronous={synchronous}, foreign_keys={foreign_keys}"
            )));
        }
        Ok(())
    }

    pub fn schema_version(&self) -> Result<i64> {
        Ok(self.conn.query_row(
            "SELECT schema_version FROM gen_global_state WHERE singleton = 1",
            [],
            |row| row.get(0),
        )?)
    }

    pub fn current_visibility_seq(&self) -> Result<i64> {
        self.read_global_i64("visibility_seq")
    }

    pub fn current_manifest_epoch(&self) -> Result<i64> {
        self.read_global_i64("manifest_epoch")
    }

    pub fn vector_high_water(&self) -> Result<i64> {
        self.read_global_i64("vector_high_water")
    }

    pub fn runtime_fence_high_water(&self) -> Result<i64> {
        self.read_global_i64("runtime_fence_high_water")
    }

    fn read_global_i64(&self, column: &str) -> Result<i64> {
        let sql = match column {
            "visibility_seq" => "SELECT visibility_seq FROM gen_global_state WHERE singleton = 1",
            "manifest_epoch" => "SELECT manifest_epoch FROM gen_global_state WHERE singleton = 1",
            "vector_high_water" => {
                "SELECT vector_high_water FROM gen_global_state WHERE singleton = 1"
            }
            "runtime_fence_high_water" => {
                "SELECT runtime_fence_high_water FROM gen_global_state WHERE singleton = 1"
            }
            _ => {
                return Err(GenIndexError::Invariant(format!(
                    "unsupported global column: {column}"
                )))
            }
        };
        Ok(self.conn.query_row(sql, [], |row| row.get(0))?)
    }

    pub fn allocate_vector_id(&mut self) -> Result<i64> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current: i64 = tx.query_row(
            "SELECT vector_high_water FROM gen_global_state WHERE singleton = 1",
            [],
            |row| row.get(0),
        )?;
        if current == i64::MAX {
            return Err(GenIndexError::Exhausted("vector_id"));
        }
        let next = current + 1;
        tx.execute(
            "UPDATE gen_global_state SET vector_high_water = ?1 WHERE singleton = 1",
            params![next],
        )?;
        tx.commit()?;
        Ok(next)
    }

    pub fn observe_source(
        &mut self,
        doc_id: &str,
        uri: &str,
        observed_revision: &str,
        observed_digest: &str,
    ) -> Result<()> {
        require_nonempty("doc_id", doc_id)?;
        require_nonempty("uri", uri)?;
        require_nonempty("observed_revision", observed_revision)?;
        require_sha256(observed_digest)?;

        let now = now_ms();
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;

        tx.execute(
            "UPDATE document_uri_history
             SET is_active = 0, last_seen_ms = ?1
             WHERE doc_id = ?2 AND is_active = 1",
            params![now, doc_id],
        )?;

        tx.execute(
            r#"
            INSERT INTO documents(
                doc_id, active_uri, document_state, source_presence,
                observed_source_revision, observed_source_digest,
                reconcile_target_revision, reconciliation_state,
                index_state, updated_at_ms
            ) VALUES (?1, ?2, 'ACTIVE', 'PRESENT', ?3, ?4, ?3, 'PENDING', 'INDEX_LAGGING', ?5)
            ON CONFLICT(doc_id) DO UPDATE SET
                active_uri = excluded.active_uri,
                document_state = 'ACTIVE',
                source_presence = 'PRESENT',
                observed_source_revision = excluded.observed_source_revision,
                observed_source_digest = excluded.observed_source_digest,
                reconcile_target_revision = excluded.reconcile_target_revision,
                reconciliation_state = 'PENDING',
                index_state = 'INDEX_LAGGING',
                updated_at_ms = excluded.updated_at_ms
            "#,
            params![doc_id, uri, observed_revision, observed_digest, now],
        )?;

        tx.execute(
            r#"
            INSERT INTO document_uri_history(
                doc_id, uri, first_seen_ms, last_seen_ms, is_active
            ) VALUES (?1, ?2, ?3, ?3, 1)
            ON CONFLICT(doc_id, uri) DO UPDATE SET
                last_seen_ms = excluded.last_seen_ms,
                is_active = 1
            "#,
            params![doc_id, uri, now],
        )?;

        tx.commit()?;
        Ok(())
    }

    pub fn mark_source_missing(&mut self, doc_id: &str) -> Result<()> {
        let now = now_ms();
        let changed = self.conn.execute(
            "UPDATE documents
             SET source_presence = 'MISSING',
                 index_state = 'INDEX_LAGGING',
                 updated_at_ms = ?1
             WHERE doc_id = ?2 AND document_state = 'ACTIVE'",
            params![now, doc_id],
        )?;
        if changed != 1 {
            return Err(GenIndexError::NotFound(format!("document {doc_id}")));
        }
        Ok(())
    }

    pub fn explicitly_delete_document(&mut self, doc_id: &str) -> Result<()> {
        let now = now_ms();
        let changed = self.conn.execute(
            "UPDATE documents
             SET document_state = 'DELETED',
                 source_presence = 'MISSING',
                 index_state = 'INDEX_LAGGING',
                 updated_at_ms = ?1
             WHERE doc_id = ?2 AND document_state = 'ACTIVE'",
            params![now, doc_id],
        )?;
        if changed != 1 {
            return Err(GenIndexError::NotFound(format!("document {doc_id}")));
        }
        Ok(())
    }

    pub fn admit_reconciliation(&mut self, doc_id: &str, target_revision: &str) -> Result<()> {
        let changed = self.conn.execute(
            "UPDATE documents
             SET reconciliation_state = 'ADMITTED', updated_at_ms = ?1
             WHERE doc_id = ?2
               AND reconcile_target_revision = ?3
               AND reconciliation_state = 'PENDING'",
            params![now_ms(), doc_id, target_revision],
        )?;
        if changed != 1 {
            return Err(GenIndexError::Conflict(format!(
                "reconciliation admission is stale for doc_id={doc_id}"
            )));
        }
        Ok(())
    }

    pub fn complete_reconciliation(&mut self, doc_id: &str, target_revision: &str) -> Result<()> {
        let changed = self.conn.execute(
            "UPDATE documents
             SET reconciliation_state = 'COMPLETE',
                 index_state = 'CURRENT',
                 updated_at_ms = ?1
             WHERE doc_id = ?2
               AND reconcile_target_revision = ?3
               AND reconciliation_state IN ('PENDING', 'ADMITTED')",
            params![now_ms(), doc_id, target_revision],
        )?;
        if changed != 1 {
            return Err(GenIndexError::Conflict(format!(
                "reconciliation completion is stale for doc_id={doc_id}"
            )));
        }
        Ok(())
    }

    pub fn source_record(&self, doc_id: &str) -> Result<SourceRecord> {
        self.conn
            .query_row(
                "SELECT doc_id, active_uri, document_state, source_presence,
                        observed_source_revision, observed_source_digest,
                        reconcile_target_revision, reconciliation_state, index_state
                 FROM documents WHERE doc_id = ?1",
                params![doc_id],
                |row| {
                    Ok(SourceRecord {
                        doc_id: row.get(0)?,
                        active_uri: row.get(1)?,
                        document_state: row.get(2)?,
                        source_presence: row.get(3)?,
                        observed_source_revision: row.get(4)?,
                        observed_source_digest: row.get(5)?,
                        reconcile_target_revision: row.get(6)?,
                        reconciliation_state: row.get(7)?,
                        index_state: row.get(8)?,
                    })
                },
            )
            .optional()?
            .ok_or_else(|| GenIndexError::NotFound(format!("document {doc_id}")))
    }

    pub fn ensure_chunk(
        &mut self,
        doc_id: &str,
        chunk_id: &str,
        logical_slot: Option<i64>,
    ) -> Result<()> {
        let doc_exists: Option<i64> = self
            .conn
            .query_row(
                "SELECT 1 FROM documents
                 WHERE doc_id = ?1 AND document_state = 'ACTIVE'",
                params![doc_id],
                |row| row.get(0),
            )
            .optional()?;
        if doc_exists.is_none() {
            return Err(GenIndexError::NotFound(format!("active document {doc_id}")));
        }

        self.conn.execute(
            r#"
            INSERT INTO chunk_heads(
                chunk_id, doc_id, current_version_id, logical_slot, updated_at_ms
            ) VALUES (?1, ?2, NULL, ?3, ?4)
            ON CONFLICT(chunk_id) DO UPDATE SET
                logical_slot = excluded.logical_slot,
                updated_at_ms = excluded.updated_at_ms
            WHERE chunk_heads.doc_id = excluded.doc_id
            "#,
            params![chunk_id, doc_id, logical_slot, now_ms()],
        )?;

        let actual_doc: String = self.conn.query_row(
            "SELECT doc_id FROM chunk_heads WHERE chunk_id = ?1",
            params![chunk_id],
            |row| row.get(0),
        )?;
        if actual_doc != doc_id {
            return Err(GenIndexError::Conflict(format!(
                "chunk_id {chunk_id} already belongs to another document"
            )));
        }
        Ok(())
    }

    pub fn prepare_chunk_version(
        &mut self,
        chunk_id: &str,
        version_id: &str,
        content_sha256: &str,
    ) -> Result<()> {
        require_sha256(content_sha256)?;
        let chunk_exists: Option<i64> = self
            .conn
            .query_row(
                "SELECT 1 FROM chunk_heads WHERE chunk_id = ?1",
                params![chunk_id],
                |row| row.get(0),
            )
            .optional()?;
        if chunk_exists.is_none() {
            return Err(GenIndexError::NotFound(format!("chunk {chunk_id}")));
        }

        self.conn.execute(
            "INSERT INTO chunk_versions(
                version_id, chunk_id, vector_id, state, content_sha256,
                embedding_fingerprint, created_visibility_seq,
                retired_visibility_seq, created_at_ms
             ) VALUES (?1, ?2, NULL, 'PREPARED', ?3, NULL, NULL, NULL, ?4)",
            params![version_id, chunk_id, content_sha256, now_ms()],
        )?;
        Ok(())
    }

    pub fn mark_embedding(&mut self, version_id: &str) -> Result<()> {
        self.transition_version(version_id, "PREPARED", "EMBEDDING")
    }

    pub fn stage_vector(
        &mut self,
        version_id: &str,
        vector_id: i64,
        embedding_fingerprint: &str,
        exact_vector_bytes: &[u8],
    ) -> Result<()> {
        if vector_id <= 0 || vector_id > self.vector_high_water()? {
            return Err(GenIndexError::Invariant(format!(
                "VECTOR_ID_INVALID: {vector_id}"
            )));
        }
        require_nonempty("embedding_fingerprint", embedding_fingerprint)?;
        if exact_vector_bytes.is_empty() {
            return Err(GenIndexError::Invariant(
                "VECTOR_RECOVERY_MATERIAL_MISSING".to_string(),
            ));
        }

        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let changed = tx.execute(
            "UPDATE chunk_versions
             SET state = 'VECTOR_STAGED',
                 vector_id = ?1,
                 embedding_fingerprint = ?2
             WHERE version_id = ?3 AND state = 'EMBEDDING' AND vector_id IS NULL",
            params![vector_id, embedding_fingerprint, version_id],
        )?;
        if changed != 1 {
            return Err(GenIndexError::Conflict(format!(
                "invalid EMBEDDING -> VECTOR_STAGED transition for {version_id}"
            )));
        }

        tx.execute(
            "INSERT INTO vector_recovery(
                vector_id, state, exact_vector_bytes,
                embedding_fingerprint, covered_segment_id, updated_at_ms
             ) VALUES (?1, 'RECOVERY_REQUIRED', ?2, ?3, NULL, ?4)",
            params![
                vector_id,
                exact_vector_bytes,
                embedding_fingerprint,
                now_ms()
            ],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn publish_current_head(
        &mut self,
        chunk_id: &str,
        expected_previous_version_id: Option<&str>,
        new_version_id: &str,
    ) -> Result<i64> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;

        let current: Option<String> = tx
            .query_row(
                "SELECT current_version_id FROM chunk_heads WHERE chunk_id = ?1",
                params![chunk_id],
                |row| row.get(0),
            )
            .optional()?
            .flatten();

        if current.as_deref() != expected_previous_version_id {
            return Err(GenIndexError::Conflict(format!(
                "STALE_VECTOR_PUBLICATION: expected={expected_previous_version_id:?}, current={current:?}"
            )));
        }

        let staged_chunk: Option<String> = tx
            .query_row(
                "SELECT chunk_id FROM chunk_versions
                 WHERE version_id = ?1 AND state = 'VECTOR_STAGED'",
                params![new_version_id],
                |row| row.get(0),
            )
            .optional()?;
        if staged_chunk.as_deref() != Some(chunk_id) {
            return Err(GenIndexError::Conflict(format!(
                "new version {new_version_id} is not a staged version of chunk {chunk_id}"
            )));
        }

        let visibility_seq = bump_global_sequence(&tx, "visibility_seq")?;

        if let Some(previous) = current.as_deref() {
            let retired = tx.execute(
                "UPDATE chunk_versions
                 SET state = 'RETIRED', retired_visibility_seq = ?1
                 WHERE version_id = ?2 AND state = 'ACTIVE'",
                params![visibility_seq, previous],
            )?;
            if retired != 1 {
                return Err(GenIndexError::Conflict(format!(
                    "previous head {previous} is not ACTIVE"
                )));
            }
        }

        let activated = tx.execute(
            "UPDATE chunk_versions
             SET state = 'ACTIVE', created_visibility_seq = ?1
             WHERE version_id = ?2 AND state = 'VECTOR_STAGED'",
            params![visibility_seq, new_version_id],
        )?;
        if activated != 1 {
            return Err(GenIndexError::Conflict(format!(
                "new head {new_version_id} could not be activated"
            )));
        }

        tx.execute(
            "UPDATE chunk_heads
             SET current_version_id = ?1, updated_at_ms = ?2
             WHERE chunk_id = ?3",
            params![new_version_id, now_ms(), chunk_id],
        )?;
        tx.commit()?;
        Ok(visibility_seq)
    }

    pub fn abort_version(&mut self, version_id: &str) -> Result<()> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let vector_id: Option<i64> = tx
            .query_row(
                "SELECT vector_id FROM chunk_versions
                 WHERE version_id = ?1
                   AND state IN ('PREPARED', 'EMBEDDING', 'VECTOR_STAGED')",
                params![version_id],
                |row| row.get(0),
            )
            .optional()?
            .flatten();

        let changed = tx.execute(
            "UPDATE chunk_versions
             SET state = 'ABORTED'
             WHERE version_id = ?1
               AND state IN ('PREPARED', 'EMBEDDING', 'VECTOR_STAGED')",
            params![version_id],
        )?;
        if changed != 1 {
            return Err(GenIndexError::Conflict(format!(
                "version {version_id} cannot transition to ABORTED"
            )));
        }
        if let Some(vector_id) = vector_id {
            tx.execute(
                "DELETE FROM vector_recovery WHERE vector_id = ?1",
                params![vector_id],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn chunk_head(&self, chunk_id: &str) -> Result<Option<String>> {
        self.conn
            .query_row(
                "SELECT current_version_id FROM chunk_heads WHERE chunk_id = ?1",
                params![chunk_id],
                |row| row.get(0),
            )
            .optional()?
            .ok_or_else(|| GenIndexError::NotFound(format!("chunk {chunk_id}")))
    }

    pub fn version_record(&self, version_id: &str) -> Result<VersionRecord> {
        self.conn
            .query_row(
                "SELECT version_id, chunk_id, vector_id, state,
                        created_visibility_seq, retired_visibility_seq
                 FROM chunk_versions WHERE version_id = ?1",
                params![version_id],
                |row| {
                    Ok(VersionRecord {
                        version_id: row.get(0)?,
                        chunk_id: row.get(1)?,
                        vector_id: row.get(2)?,
                        state: row.get(3)?,
                        created_visibility_seq: row.get(4)?,
                        retired_visibility_seq: row.get(5)?,
                    })
                },
            )
            .optional()?
            .ok_or_else(|| GenIndexError::NotFound(format!("version {version_id}")))
    }

    fn transition_version(&mut self, version_id: &str, from: &str, to: &str) -> Result<()> {
        let changed = self.conn.execute(
            "UPDATE chunk_versions SET state = ?1 WHERE version_id = ?2 AND state = ?3",
            params![to, version_id, from],
        )?;
        if changed != 1 {
            return Err(GenIndexError::Conflict(format!(
                "invalid version transition {from} -> {to} for {version_id}"
            )));
        }
        Ok(())
    }

    pub fn register_finalized_segment(
        &mut self,
        segment_id: &str,
        artifact_path: impl AsRef<Path>,
        expected_sha256: &str,
        embedding_fingerprint: &str,
        vector_ids: &[i64],
    ) -> Result<()> {
        require_nonempty("segment_id", segment_id)?;
        require_sha256(expected_sha256)?;
        require_nonempty("embedding_fingerprint", embedding_fingerprint)?;

        let artifact_path = artifact_path.as_ref();
        let actual_digest = sync_and_sha256_file(artifact_path)?;
        if actual_digest != expected_sha256 {
            return Err(GenIndexError::Invariant(format!(
                "SEGMENT_DURABILITY_UNPROVEN: digest mismatch expected={expected_sha256} actual={actual_digest}"
            )));
        }
        sync_parent_directory(artifact_path)?;

        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;

        tx.execute(
            "INSERT INTO segments(
                segment_id, state, artifact_path, artifact_digest,
                embedding_fingerprint, artifact_verified,
                final_name_durable, published_manifest_epoch, created_at_ms
             ) VALUES (?1, 'FINALIZED_DURABLE', ?2, ?3, ?4, 1, 1, NULL, ?5)",
            params![
                segment_id,
                artifact_path.to_string_lossy(),
                expected_sha256,
                embedding_fingerprint,
                now_ms()
            ],
        )?;

        let unique: BTreeSet<i64> = vector_ids.iter().copied().collect();
        if unique.len() != vector_ids.len() {
            return Err(GenIndexError::Invariant(
                "duplicate vector ids in segment registration".to_string(),
            ));
        }
        for vector_id in unique {
            if vector_id <= 0 {
                return Err(GenIndexError::Invariant(
                    "VECTOR_ID_INVALID in segment".to_string(),
                ));
            }
            let exists: Option<i64> = tx
                .query_row(
                    "SELECT 1 FROM chunk_versions
                     WHERE vector_id = ?1
                       AND embedding_fingerprint = ?2
                       AND state IN ('VECTOR_STAGED', 'ACTIVE', 'RETIRED', 'GC_ELIGIBLE')",
                    params![vector_id, embedding_fingerprint],
                    |row| row.get(0),
                )
                .optional()?;
            if exists.is_none() {
                return Err(GenIndexError::NotFound(format!(
                    "vector {vector_id} for segment {segment_id}"
                )));
            }
            tx.execute(
                "INSERT INTO segment_vectors(segment_id, vector_id) VALUES (?1, ?2)",
                params![segment_id, vector_id],
            )?;
        }

        tx.commit()?;
        Ok(())
    }

    pub fn publish_manifest(
        &mut self,
        captured_manifest_epoch: i64,
        embedding_fingerprint: &str,
        segment_ids: &[String],
    ) -> Result<i64> {
        require_nonempty("embedding_fingerprint", embedding_fingerprint)?;
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let current: i64 = tx.query_row(
            "SELECT manifest_epoch FROM gen_global_state WHERE singleton = 1",
            [],
            |row| row.get(0),
        )?;
        if current != captured_manifest_epoch {
            return Err(GenIndexError::Conflict(format!(
                "COMPACTION_PUBLICATION_STALE: captured={captured_manifest_epoch}, current={current}"
            )));
        }
        if current == i64::MAX {
            return Err(GenIndexError::Exhausted("manifest_epoch"));
        }

        let unique: BTreeSet<&str> = segment_ids.iter().map(String::as_str).collect();
        if unique.len() != segment_ids.len() {
            return Err(GenIndexError::Invariant(
                "manifest contains duplicate segment ids".to_string(),
            ));
        }

        for segment_id in &unique {
            let valid: Option<i64> = tx
                .query_row(
                    "SELECT 1 FROM segments
                     WHERE segment_id = ?1
                       AND embedding_fingerprint = ?2
                       AND state IN ('FINALIZED_DURABLE', 'PUBLISHED')
                       AND artifact_verified = 1
                       AND final_name_durable = 1",
                    params![segment_id, embedding_fingerprint],
                    |row| row.get(0),
                )
                .optional()?;
            if valid.is_none() {
                return Err(GenIndexError::Invariant(format!(
                    "SEGMENT_DURABILITY_UNPROVEN: {segment_id}"
                )));
            }
            verify_registered_segment_artifact(&tx, segment_id)?;
        }

        let next = current + 1;
        tx.execute(
            "INSERT INTO manifest_epochs(
                manifest_epoch, previous_epoch, embedding_fingerprint, published_at_ms
             ) VALUES (?1, ?2, ?3, ?4)",
            params![next, current, embedding_fingerprint, now_ms()],
        )?;

        for segment_id in &unique {
            tx.execute(
                "INSERT INTO manifest_segments(manifest_epoch, segment_id) VALUES (?1, ?2)",
                params![next, segment_id],
            )?;
            tx.execute(
                "UPDATE segments
                 SET state = 'PUBLISHED', published_manifest_epoch = ?1
                 WHERE segment_id = ?2",
                params![next, segment_id],
            )?;
        }

        let mut statement =
            tx.prepare("SELECT segment_id FROM segments WHERE state = 'PUBLISHED'")?;
        let published = statement
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        drop(statement);

        for segment_id in published {
            if !unique.contains(segment_id.as_str()) {
                tx.execute(
                    "UPDATE segments SET state = 'RETIRED' WHERE segment_id = ?1",
                    params![segment_id],
                )?;
            }
        }

        tx.execute(
            "UPDATE gen_global_state SET manifest_epoch = ?1 WHERE singleton = 1",
            params![next],
        )?;
        tx.commit()?;
        Ok(next)
    }

    pub fn current_manifest_segments(&self) -> Result<Vec<String>> {
        let epoch = self.current_manifest_epoch()?;
        let mut statement = self.conn.prepare(
            "SELECT segment_id FROM manifest_segments
             WHERE manifest_epoch = ?1 ORDER BY segment_id",
        )?;
        let rows = statement
            .query_map(params![epoch], |row| row.get::<_, String>(0))?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn current_manifest_fingerprint(&self) -> Result<Option<String>> {
        let epoch = self.current_manifest_epoch()?;
        Ok(self.conn.query_row(
            "SELECT embedding_fingerprint FROM manifest_epochs WHERE manifest_epoch = ?1",
            params![epoch],
            |row| row.get(0),
        )?)
    }

    pub fn mark_recovery_segment_covered(
        &mut self,
        vector_id: i64,
        segment_id: &str,
    ) -> Result<()> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        require_current_manifest_coverage(&tx, vector_id, segment_id)?;

        let changed = tx.execute(
            "UPDATE vector_recovery
             SET state = 'SEGMENT_COVERED',
                 covered_segment_id = ?1,
                 updated_at_ms = ?2
             WHERE vector_id = ?3 AND state = 'RECOVERY_REQUIRED'",
            params![segment_id, now_ms(), vector_id],
        )?;
        if changed != 1 {
            return Err(GenIndexError::Conflict(format!(
                "recovery for vector {vector_id} is not RECOVERY_REQUIRED"
            )));
        }
        tx.commit()?;
        Ok(())
    }

    pub fn mark_recovery_reclaimable(&mut self, vector_id: i64) -> Result<()> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let segment_id: Option<String> = tx
            .query_row(
                "SELECT covered_segment_id FROM vector_recovery
                 WHERE vector_id = ?1 AND state = 'SEGMENT_COVERED'",
                params![vector_id],
                |row| row.get(0),
            )
            .optional()?
            .flatten();
        let segment_id = segment_id.ok_or_else(|| {
            GenIndexError::Conflict(format!(
                "recovery for vector {vector_id} is not SEGMENT_COVERED"
            ))
        })?;
        require_current_manifest_coverage(&tx, vector_id, &segment_id)?;

        tx.execute(
            "UPDATE vector_recovery
             SET state = 'RECOVERY_RECLAIMABLE', updated_at_ms = ?1
             WHERE vector_id = ?2",
            params![now_ms(), vector_id],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn release_recovery_material(&mut self, vector_id: i64) -> Result<()> {
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let segment_id: Option<String> = tx
            .query_row(
                "SELECT covered_segment_id FROM vector_recovery
                 WHERE vector_id = ?1 AND state = 'RECOVERY_RECLAIMABLE'",
                params![vector_id],
                |row| row.get(0),
            )
            .optional()?
            .flatten();
        let segment_id = segment_id.ok_or_else(|| {
            GenIndexError::Conflict(format!(
                "recovery for vector {vector_id} is not RECOVERY_RECLAIMABLE"
            ))
        })?;
        require_current_manifest_coverage(&tx, vector_id, &segment_id)?;

        tx.execute(
            "UPDATE vector_recovery
             SET state = 'RECOVERY_RELEASED',
                 exact_vector_bytes = NULL,
                 updated_at_ms = ?1
             WHERE vector_id = ?2",
            params![now_ms(), vector_id],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn recovery_record(&self, vector_id: i64) -> Result<RecoveryRecord> {
        self.conn
            .query_row(
                "SELECT vector_id, state, covered_segment_id,
                        exact_vector_bytes IS NOT NULL
                 FROM vector_recovery WHERE vector_id = ?1",
                params![vector_id],
                |row| {
                    Ok(RecoveryRecord {
                        vector_id: row.get(0)?,
                        state: row.get(1)?,
                        covered_segment_id: row.get(2)?,
                        has_exact_vector_bytes: row.get::<_, i64>(3)? != 0,
                    })
                },
            )
            .optional()?
            .ok_or_else(|| GenIndexError::NotFound(format!("recovery {vector_id}")))
    }

    pub fn acquire_runtime(&mut self, owner_id: &str) -> Result<RuntimeLease> {
        require_nonempty("owner_id", owner_id)?;
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        let (current_owner, current_state): (Option<String>, String) = tx.query_row(
            "SELECT owner_id, state FROM runtime_ownership WHERE singleton = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        if current_owner.is_some() || current_state != "UNOWNED" {
            return Err(GenIndexError::Conflict(format!(
                "INDEX_RUNTIME_ALREADY_OWNED: owner={current_owner:?}, state={current_state}"
            )));
        }

        let current_fence: i64 = tx.query_row(
            "SELECT runtime_fence_high_water FROM gen_global_state WHERE singleton = 1",
            [],
            |row| row.get(0),
        )?;
        if current_fence == i64::MAX {
            return Err(GenIndexError::Exhausted("runtime_fence"));
        }
        let next_fence = current_fence + 1;

        tx.execute(
            "UPDATE gen_global_state
             SET runtime_fence_high_water = ?1
             WHERE singleton = 1",
            params![next_fence],
        )?;
        tx.execute(
            "UPDATE runtime_ownership
             SET owner_id = ?1, fence = ?2,
                 state = 'SERVING', acquired_at_ms = ?3
             WHERE singleton = 1",
            params![owner_id, next_fence, now_ms()],
        )?;
        tx.commit()?;

        Ok(RuntimeLease {
            owner_id: owner_id.to_string(),
            fence: next_fence,
        })
    }

    pub fn begin_runtime_drain(&mut self, lease: &RuntimeLease) -> Result<()> {
        let changed = self.conn.execute(
            "UPDATE runtime_ownership SET state = 'DRAINING'
             WHERE singleton = 1
               AND owner_id = ?1
               AND fence = ?2
               AND state = 'SERVING'",
            params![lease.owner_id, lease.fence],
        )?;
        if changed != 1 {
            return Err(GenIndexError::Conflict(
                "RUNTIME_FENCE_STALE while entering drain".to_string(),
            ));
        }
        Ok(())
    }

    pub fn release_runtime(&mut self, lease: &RuntimeLease) -> Result<()> {
        let changed = self.conn.execute(
            "UPDATE runtime_ownership
             SET owner_id = NULL, state = 'UNOWNED', acquired_at_ms = NULL
             WHERE singleton = 1
               AND owner_id = ?1
               AND fence = ?2
               AND state = 'DRAINING'",
            params![lease.owner_id, lease.fence],
        )?;
        if changed != 1 {
            return Err(GenIndexError::Conflict(
                "RUNTIME_FENCE_STALE while releasing ownership".to_string(),
            ));
        }
        Ok(())
    }

    pub fn validate_runtime_fence(&self, lease: &RuntimeLease) -> Result<bool> {
        let valid: i64 = self.conn.query_row(
            "SELECT EXISTS(
                SELECT 1 FROM runtime_ownership
                WHERE singleton = 1
                  AND owner_id = ?1
                  AND fence = ?2
                  AND state IN ('SERVING', 'DRAINING')
             )",
            params![lease.owner_id, lease.fence],
            |row| row.get(0),
        )?;
        Ok(valid != 0)
    }
}

fn bump_global_sequence(tx: &Transaction<'_>, name: &'static str) -> Result<i64> {
    let (select_sql, update_sql) = match name {
        "visibility_seq" => (
            "SELECT visibility_seq FROM gen_global_state WHERE singleton = 1",
            "UPDATE gen_global_state SET visibility_seq = ?1 WHERE singleton = 1",
        ),
        _ => {
            return Err(GenIndexError::Invariant(format!(
                "unsupported sequence: {name}"
            )))
        }
    };

    let current: i64 = tx.query_row(select_sql, [], |row| row.get(0))?;
    if current == i64::MAX {
        return Err(GenIndexError::Exhausted(name));
    }
    let next = current + 1;
    tx.execute(update_sql, params![next])?;
    Ok(next)
}

fn require_current_manifest_coverage(
    tx: &Transaction<'_>,
    vector_id: i64,
    segment_id: &str,
) -> Result<()> {
    let current_epoch: i64 = tx.query_row(
        "SELECT manifest_epoch FROM gen_global_state WHERE singleton = 1",
        [],
        |row| row.get(0),
    )?;

    let covered: i64 = tx.query_row(
        "SELECT EXISTS(
            SELECT 1
            FROM manifest_segments ms
            JOIN segments s ON s.segment_id = ms.segment_id
            JOIN segment_vectors sv ON sv.segment_id = s.segment_id
            WHERE ms.manifest_epoch = ?1
              AND ms.segment_id = ?2
              AND sv.vector_id = ?3
              AND s.state = 'PUBLISHED'
              AND s.artifact_verified = 1
              AND s.final_name_durable = 1
        )",
        params![current_epoch, segment_id, vector_id],
        |row| row.get(0),
    )?;

    if covered == 0 {
        return Err(GenIndexError::Invariant(format!(
            "RECOVERY_ACTIVE_VECTOR_UNRECOVERABLE: vector={vector_id}, segment={segment_id}, manifest_epoch={current_epoch}"
        )));
    }

    verify_registered_segment_artifact(tx, segment_id).map_err(|error| {
        GenIndexError::Invariant(format!(
            "RECOVERY_ACTIVE_VECTOR_UNRECOVERABLE: vector={vector_id}, segment={segment_id}, physical verification failed: {error}"
        ))
    })?;
    Ok(())
}

fn verify_registered_segment_artifact(tx: &Transaction<'_>, segment_id: &str) -> Result<()> {
    let (artifact_path, expected_digest): (String, String) = tx
        .query_row(
            "SELECT artifact_path, artifact_digest
             FROM segments
             WHERE segment_id = ?1
               AND artifact_verified = 1
               AND final_name_durable = 1",
            params![segment_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| {
            GenIndexError::Invariant(format!(
                "SEGMENT_DURABILITY_UNPROVEN: {segment_id} metadata is not durable"
            ))
        })?;

    let path = Path::new(&artifact_path);
    let actual_digest = sync_and_sha256_file(path).map_err(|error| {
        GenIndexError::Invariant(format!(
            "SEGMENT_DURABILITY_UNPROVEN: {segment_id}: {error}"
        ))
    })?;
    if actual_digest != expected_digest {
        return Err(GenIndexError::Invariant(format!(
            "SEGMENT_DURABILITY_UNPROVEN: {segment_id} digest mismatch expected={expected_digest} actual={actual_digest}"
        )));
    }
    sync_parent_directory(path).map_err(|error| {
        GenIndexError::Invariant(format!(
            "SEGMENT_DURABILITY_UNPROVEN: {segment_id} directory durability failed: {error}"
        ))
    })?;
    Ok(())
}

fn require_nonempty(name: &str, value: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(GenIndexError::Invariant(format!(
            "{name} must not be empty"
        )));
    }
    Ok(())
}

fn require_sha256(value: &str) -> Result<()> {
    if value.len() != 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(GenIndexError::Invariant(format!(
            "invalid canonical sha256: {value}"
        )));
    }
    Ok(())
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .min(i64::MAX as u128) as i64
}

fn sync_and_sha256_file(path: &Path) -> Result<String> {
    let mut file = File::open(path)?;
    file.sync_all()?;

    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(unix)]
fn sync_parent_directory(path: &Path) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| GenIndexError::Invariant("segment path has no parent".to_string()))?;
    File::open(parent)?.sync_all()?;
    Ok(())
}

#[cfg(not(unix))]
fn sync_parent_directory(_path: &Path) -> Result<()> {
    Err(GenIndexError::Invariant(
        "UNSUPPORTED_DURABILITY_PROFILE: directory durability proof is not implemented on this platform".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn unique_path(name: &str, extension: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "daily-note-searcher-{name}-{}-{nanos}.{extension}",
            std::process::id()
        ))
    }

    fn cleanup_db(path: &Path) {
        let _ = fs::remove_file(path);
        let _ = fs::remove_file(format!("{}-wal", path.to_string_lossy()));
        let _ = fs::remove_file(format!("{}-shm", path.to_string_lossy()));
    }

    fn digest_bytes(bytes: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        format!("{:x}", hasher.finalize())
    }

    fn setup_document_chunk(store: &mut MetadataStore) {
        store
            .observe_source("doc-1", "notes/a.md", "r1", &"a".repeat(64))
            .unwrap();
        store.admit_reconciliation("doc-1", "r1").unwrap();
        store.complete_reconciliation("doc-1", "r1").unwrap();
        store.ensure_chunk("doc-1", "chunk-1", Some(0)).unwrap();
    }

    fn stage_version(store: &mut MetadataStore, version_id: &str, content_byte: char) -> i64 {
        store
            .prepare_chunk_version("chunk-1", version_id, &content_byte.to_string().repeat(64))
            .unwrap();
        store.mark_embedding(version_id).unwrap();
        let vector_id = store.allocate_vector_id().unwrap();
        store
            .stage_vector(version_id, vector_id, "embed-v1", &[1, 2, 3, 4])
            .unwrap();
        vector_id
    }

    #[test]
    fn opens_crash_durable_schema() {
        let db = unique_path("schema", "db");
        let store = MetadataStore::open(&db).unwrap();
        assert_eq!(store.schema_version().unwrap(), SCHEMA_VERSION);
        assert_eq!(store.current_visibility_seq().unwrap(), 0);
        assert_eq!(store.current_manifest_epoch().unwrap(), 0);
        assert_eq!(store.vector_high_water().unwrap(), 0);
        store.verify_durability_profile().unwrap();
        drop(store);
        cleanup_db(&db);
    }

    #[test]
    fn vector_allocator_is_durable_monotonic_and_never_reuses() {
        let db = unique_path("allocator", "db");
        {
            let mut store = MetadataStore::open(&db).unwrap();
            assert_eq!(store.allocate_vector_id().unwrap(), 1);
            assert_eq!(store.allocate_vector_id().unwrap(), 2);
            assert_eq!(store.vector_high_water().unwrap(), 2);
        }
        {
            let mut reopened = MetadataStore::open(&db).unwrap();
            assert_eq!(reopened.vector_high_water().unwrap(), 2);
            assert_eq!(reopened.allocate_vector_id().unwrap(), 3);
        }
        cleanup_db(&db);
    }

    #[test]
    fn source_observation_is_atomic_and_missing_is_not_delete() {
        let db = unique_path("source", "db");
        let mut store = MetadataStore::open(&db).unwrap();

        let invalid_digest =
            store.observe_source("doc-invalid", "notes/bad.md", "r1", "not-a-sha256");
        assert!(matches!(invalid_digest, Err(GenIndexError::Invariant(_))));

        store
            .observe_source("doc-1", "notes/a.md", "r1", &"b".repeat(64))
            .unwrap();
        let observed = store.source_record("doc-1").unwrap();
        assert_eq!(observed.reconciliation_state, "PENDING");
        assert_eq!(observed.reconcile_target_revision.as_deref(), Some("r1"));
        assert_eq!(observed.index_state, "INDEX_LAGGING");

        store.mark_source_missing("doc-1").unwrap();
        let missing = store.source_record("doc-1").unwrap();
        assert_eq!(missing.document_state, "ACTIVE");
        assert_eq!(missing.source_presence, "MISSING");

        store
            .observe_source("doc-1", "moved/a.md", "r2", &"c".repeat(64))
            .unwrap();
        let moved = store.source_record("doc-1").unwrap();
        assert_eq!(moved.doc_id, "doc-1");
        assert_eq!(moved.active_uri, "moved/a.md");
        assert_eq!(moved.reconciliation_state, "PENDING");

        drop(store);
        cleanup_db(&db);
    }

    #[test]
    fn mvcc_publication_is_cas_and_advances_visibility() {
        let db = unique_path("mvcc", "db");
        let mut store = MetadataStore::open(&db).unwrap();
        setup_document_chunk(&mut store);

        let _v1 = stage_version(&mut store, "version-1", 'd');
        let seq1 = store
            .publish_current_head("chunk-1", None, "version-1")
            .unwrap();
        assert_eq!(seq1, 1);
        assert_eq!(
            store.chunk_head("chunk-1").unwrap().as_deref(),
            Some("version-1")
        );

        let _v2 = stage_version(&mut store, "version-2", 'e');
        let stale = store.publish_current_head("chunk-1", None, "version-2");
        assert!(matches!(stale, Err(GenIndexError::Conflict(_))));

        let seq2 = store
            .publish_current_head("chunk-1", Some("version-1"), "version-2")
            .unwrap();
        assert_eq!(seq2, 2);
        assert_eq!(store.current_visibility_seq().unwrap(), 2);

        let old = store.version_record("version-1").unwrap();
        let current = store.version_record("version-2").unwrap();
        assert_eq!(old.state, "RETIRED");
        assert_eq!(old.retired_visibility_seq, Some(2));
        assert_eq!(current.state, "ACTIVE");
        assert_eq!(current.created_visibility_seq, Some(2));

        drop(store);
        cleanup_db(&db);
    }

    #[test]
    fn manifest_publication_and_recovery_release_are_guarded() {
        let db = unique_path("manifest", "db");
        let segment_path = unique_path("segment", "bin");
        let mut store = MetadataStore::open(&db).unwrap();
        setup_document_chunk(&mut store);

        let vector_id = stage_version(&mut store, "version-1", 'f');
        store
            .publish_current_head("chunk-1", None, "version-1")
            .unwrap();

        let bytes = b"immutable-segment-one";
        {
            let mut file = File::create(&segment_path).unwrap();
            file.write_all(bytes).unwrap();
            file.sync_all().unwrap();
        }
        let digest = digest_bytes(bytes);

        store
            .register_finalized_segment(
                "segment-1",
                &segment_path,
                &digest,
                "embed-v1",
                &[vector_id],
            )
            .unwrap();

        let early_release = store.release_recovery_material(vector_id);
        assert!(matches!(early_release, Err(GenIndexError::Conflict(_))));

        {
            let mut file = File::create(&segment_path).unwrap();
            file.write_all(b"tampered-before-manifest").unwrap();
            file.sync_all().unwrap();
        }
        let tampered_publish = store.publish_manifest(0, "embed-v1", &["segment-1".to_string()]);
        assert!(matches!(tampered_publish, Err(GenIndexError::Invariant(_))));

        {
            let mut file = File::create(&segment_path).unwrap();
            file.write_all(bytes).unwrap();
            file.sync_all().unwrap();
        }

        let wrong_fingerprint = store.publish_manifest(0, "embed-v2", &["segment-1".to_string()]);
        assert!(matches!(
            wrong_fingerprint,
            Err(GenIndexError::Invariant(_))
        ));

        let epoch = store
            .publish_manifest(0, "embed-v1", &["segment-1".to_string()])
            .unwrap();
        assert_eq!(epoch, 1);
        assert_eq!(
            store.current_manifest_segments().unwrap(),
            vec!["segment-1".to_string()]
        );
        assert_eq!(
            store.current_manifest_fingerprint().unwrap().as_deref(),
            Some("embed-v1")
        );

        let stale = store.publish_manifest(0, "embed-v1", &["segment-1".to_string()]);
        assert!(matches!(stale, Err(GenIndexError::Conflict(_))));

        {
            let mut file = File::create(&segment_path).unwrap();
            file.write_all(b"tampered-before-recovery-release").unwrap();
            file.sync_all().unwrap();
        }
        let tampered_recovery = store.mark_recovery_segment_covered(vector_id, "segment-1");
        assert!(matches!(
            tampered_recovery,
            Err(GenIndexError::Invariant(_))
        ));

        {
            let mut file = File::create(&segment_path).unwrap();
            file.write_all(bytes).unwrap();
            file.sync_all().unwrap();
        }

        store
            .mark_recovery_segment_covered(vector_id, "segment-1")
            .unwrap();
        store.mark_recovery_reclaimable(vector_id).unwrap();
        store.release_recovery_material(vector_id).unwrap();

        let recovery = store.recovery_record(vector_id).unwrap();
        assert_eq!(recovery.state, "RECOVERY_RELEASED");
        assert_eq!(recovery.covered_segment_id.as_deref(), Some("segment-1"));
        assert!(!recovery.has_exact_vector_bytes);

        drop(store);
        cleanup_db(&db);
        let _ = fs::remove_file(segment_path);
    }

    #[test]
    fn crashed_runtime_remains_fail_closed_until_explicit_recovery_exists() {
        let db = unique_path("runtime-crash", "db");
        {
            let mut store = MetadataStore::open(&db).unwrap();
            let lease = store.acquire_runtime("runtime-crashed").unwrap();
            assert_eq!(lease.fence, 1);
        }

        let mut reopened = MetadataStore::open(&db).unwrap();
        let takeover = reopened.acquire_runtime("runtime-new");
        assert!(matches!(takeover, Err(GenIndexError::Conflict(_))));
        assert_eq!(reopened.runtime_fence_high_water().unwrap(), 1);

        drop(reopened);
        cleanup_db(&db);
    }

    #[test]
    fn runtime_ownership_is_exclusive_and_fenced() {
        let db = unique_path("runtime", "db");
        let mut store = MetadataStore::open(&db).unwrap();

        let first = store.acquire_runtime("runtime-a").unwrap();
        assert_eq!(first.fence, 1);
        assert!(store.validate_runtime_fence(&first).unwrap());

        let second = store.acquire_runtime("runtime-b");
        assert!(matches!(second, Err(GenIndexError::Conflict(_))));

        store.begin_runtime_drain(&first).unwrap();
        assert!(store.validate_runtime_fence(&first).unwrap());
        store.release_runtime(&first).unwrap();
        assert!(!store.validate_runtime_fence(&first).unwrap());

        let replacement = store.acquire_runtime("runtime-b").unwrap();
        assert_eq!(replacement.fence, 2);
        assert_eq!(store.runtime_fence_high_water().unwrap(), 2);

        drop(store);
        cleanup_db(&db);
    }
}
