use crate::gen_usearch::{GenIndexError, Result};
use std::sync::{RwLock, RwLockReadGuard, RwLockWriteGuard};
use usearch::{Index, IndexOptions, MetricKind, ScalarKind};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MemTableState {
    Active,
    SealedQueryVisible,
    Flushing,
    SegmentPublished,
    RetiredQueryVisible,
    Reclaimable,
}

impl MemTableState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "ACTIVE",
            Self::SealedQueryVisible => "SEALED_QUERY_VISIBLE",
            Self::Flushing => "FLUSHING",
            Self::SegmentPublished => "SEGMENT_PUBLISHED",
            Self::RetiredQueryVisible => "RETIRED_QUERY_VISIBLE",
            Self::Reclaimable => "RECLAIMABLE",
        }
    }

    fn query_visible(self) -> bool {
        self != Self::Reclaimable
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct AnnCandidate {
    pub vector_id: i64,
    pub distance: f32,
    pub memtable_generation: u64,
}

pub struct Gen0MemTable {
    index: Index,
    state: RwLock<MemTableState>,
    generation_id: u64,
    dimensions: usize,
    embedding_fingerprint: String,
}

impl Gen0MemTable {
    pub fn new(
        generation_id: u64,
        dimensions: usize,
        embedding_fingerprint: impl Into<String>,
        initial_capacity: usize,
    ) -> Result<Self> {
        if generation_id == 0 {
            return Err(GenIndexError::Invariant(
                "GEN0_GENERATION_INVALID: generation_id must be > 0".to_string(),
            ));
        }
        if dimensions == 0 {
            return Err(GenIndexError::Invariant(
                "GEN0_DIMENSIONS_INVALID: dimensions must be > 0".to_string(),
            ));
        }

        let embedding_fingerprint = embedding_fingerprint.into();
        if embedding_fingerprint.trim().is_empty() {
            return Err(GenIndexError::Invariant(
                "GEN0_EMBEDDING_FINGERPRINT_MISSING".to_string(),
            ));
        }

        let options = IndexOptions {
            dimensions,
            metric: MetricKind::Cos,
            quantization: ScalarKind::F32,
            multi: false,
            ..IndexOptions::default()
        };

        let index = Index::new(&options)
            .map_err(|error| GenIndexError::Invariant(format!("USEARCH_INIT_FAILED: {error}")))?;
        index.reserve(initial_capacity.max(1)).map_err(|error| {
            GenIndexError::Invariant(format!("USEARCH_RESERVE_FAILED: {error}"))
        })?;

        Ok(Self {
            index,
            state: RwLock::new(MemTableState::Active),
            generation_id,
            dimensions,
            embedding_fingerprint,
        })
    }

    pub fn generation_id(&self) -> u64 {
        self.generation_id
    }

    pub fn dimensions(&self) -> usize {
        self.dimensions
    }

    pub fn embedding_fingerprint(&self) -> &str {
        &self.embedding_fingerprint
    }

    pub fn state(&self) -> Result<MemTableState> {
        Ok(*self.read_state()?)
    }

    pub fn size(&self) -> usize {
        self.index.size()
    }

    pub fn capacity(&self) -> usize {
        self.index.capacity()
    }

    pub fn contains(&self, vector_id: i64) -> Result<bool> {
        let key = vector_key(vector_id)?;
        Ok(self.index.contains(key))
    }

    pub fn add(&self, vector_id: i64, vector: &[f32]) -> Result<()> {
        let state = self.write_state()?;
        if *state != MemTableState::Active {
            return Err(GenIndexError::Conflict(format!(
                "GEN0_NOT_WRITABLE: state={}",
                state.as_str()
            )));
        }
        validate_vector(self.dimensions, vector)?;
        let key = vector_key(vector_id)?;
        if self.index.contains(key) {
            return Err(GenIndexError::Conflict(format!(
                "VECTOR_ID_COLLISION: {vector_id}"
            )));
        }

        let size = self.index.size();
        if size >= self.index.capacity() {
            let next_capacity = self
                .index
                .capacity()
                .saturating_mul(2)
                .max(size.saturating_add(1))
                .max(16);
            self.index.reserve(next_capacity).map_err(|error| {
                GenIndexError::Invariant(format!("USEARCH_RESERVE_FAILED: {error}"))
            })?;
        }

        self.index
            .add(key, vector)
            .map_err(|error| GenIndexError::Invariant(format!("USEARCH_ADD_FAILED: {error}")))?;
        Ok(())
    }

    pub fn search(&self, query: &[f32], count: usize) -> Result<Vec<AnnCandidate>> {
        let state = self.read_state()?;
        if !state.query_visible() {
            return Err(GenIndexError::Conflict(
                "GEN0_NOT_QUERY_VISIBLE: state=RECLAIMABLE".to_string(),
            ));
        }
        if count == 0 {
            return Ok(Vec::new());
        }
        validate_vector(self.dimensions, query)?;

        let result_count = count.min(self.index.size());
        if result_count == 0 {
            return Ok(Vec::new());
        }
        let matches = self
            .index
            .search(query, result_count)
            .map_err(|error| GenIndexError::Invariant(format!("USEARCH_SEARCH_FAILED: {error}")))?;

        let mut candidates = Vec::with_capacity(matches.keys.len());
        for (key, distance) in matches.keys.iter().zip(matches.distances.iter()) {
            let vector_id = i64::try_from(*key).map_err(|_| {
                GenIndexError::Invariant(format!("VECTOR_ID_INVALID_FROM_USEARCH: {key}"))
            })?;
            candidates.push(AnnCandidate {
                vector_id,
                distance: *distance,
                memtable_generation: self.generation_id,
            });
        }
        Ok(candidates)
    }

    pub fn seal(&self) -> Result<()> {
        self.transition(MemTableState::Active, MemTableState::SealedQueryVisible)
    }

    pub fn begin_flush(&self) -> Result<()> {
        self.transition(MemTableState::SealedQueryVisible, MemTableState::Flushing)
    }

    pub fn mark_segment_published(&self) -> Result<()> {
        self.transition(MemTableState::Flushing, MemTableState::SegmentPublished)
    }

    pub fn mark_retired_query_visible(&self) -> Result<()> {
        self.transition(
            MemTableState::SegmentPublished,
            MemTableState::RetiredQueryVisible,
        )
    }

    pub fn mark_reclaimable(&self) -> Result<()> {
        self.transition(
            MemTableState::RetiredQueryVisible,
            MemTableState::Reclaimable,
        )
    }

    pub fn hydrate_f32_le(&self, rows: &[(i64, Vec<u8>)]) -> Result<()> {
        for (vector_id, bytes) in rows {
            let vector = decode_f32_le(bytes, self.dimensions)?;
            self.add(*vector_id, &vector)?;
        }
        Ok(())
    }

    fn transition(&self, expected: MemTableState, next: MemTableState) -> Result<()> {
        let mut state = self.write_state()?;
        if *state != expected {
            return Err(GenIndexError::Conflict(format!(
                "INVALID_MEMTABLE_TRANSITION: expected={}, actual={}, next={}",
                expected.as_str(),
                state.as_str(),
                next.as_str()
            )));
        }
        *state = next;
        Ok(())
    }

    fn read_state(&self) -> Result<RwLockReadGuard<'_, MemTableState>> {
        self.state
            .read()
            .map_err(|_| GenIndexError::Invariant("GEN0_STATE_LOCK_POISONED".to_string()))
    }

    fn write_state(&self) -> Result<RwLockWriteGuard<'_, MemTableState>> {
        self.state
            .write()
            .map_err(|_| GenIndexError::Invariant("GEN0_STATE_LOCK_POISONED".to_string()))
    }
}

pub fn encode_f32_le(vector: &[f32]) -> Result<Vec<u8>> {
    if vector.iter().any(|value| !value.is_finite()) {
        return Err(GenIndexError::Invariant(
            "GEN0_VECTOR_NONFINITE".to_string(),
        ));
    }
    let mut bytes = Vec::with_capacity(std::mem::size_of_val(vector));
    for value in vector {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    Ok(bytes)
}

pub fn decode_f32_le(bytes: &[u8], dimensions: usize) -> Result<Vec<f32>> {
    if dimensions == 0 || bytes.len() != dimensions * std::mem::size_of::<f32>() {
        return Err(GenIndexError::Invariant(format!(
            "GEN0_RECOVERY_VECTOR_BYTES_INVALID: dimensions={dimensions}, bytes={}",
            bytes.len()
        )));
    }
    let mut vector = Vec::with_capacity(dimensions);
    for chunk in bytes.chunks_exact(4) {
        let value = f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
        if !value.is_finite() {
            return Err(GenIndexError::Invariant(
                "GEN0_VECTOR_NONFINITE".to_string(),
            ));
        }
        vector.push(value);
    }
    Ok(vector)
}

fn validate_vector(dimensions: usize, vector: &[f32]) -> Result<()> {
    if vector.len() != dimensions {
        return Err(GenIndexError::Invariant(format!(
            "GEN0_DIMENSION_MISMATCH: expected={dimensions}, actual={}",
            vector.len()
        )));
    }
    if vector.iter().any(|value| !value.is_finite()) {
        return Err(GenIndexError::Invariant(
            "GEN0_VECTOR_NONFINITE".to_string(),
        ));
    }
    Ok(())
}

fn vector_key(vector_id: i64) -> Result<u64> {
    if vector_id <= 0 {
        return Err(GenIndexError::Invariant(format!(
            "VECTOR_ID_INVALID: {vector_id}"
        )));
    }
    Ok(vector_id as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn table() -> Gen0MemTable {
        Gen0MemTable::new(7, 4, "embed-v1", 2).unwrap()
    }

    #[test]
    fn adds_and_searches_physical_candidates() {
        let table = table();
        table.add(10, &[1.0, 0.0, 0.0, 0.0]).unwrap();
        table.add(11, &[0.0, 1.0, 0.0, 0.0]).unwrap();

        let hits = table.search(&[1.0, 0.0, 0.0, 0.0], 2).unwrap();
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].vector_id, 10);
        assert_eq!(hits[0].memtable_generation, 7);
        assert!(hits[0].distance <= hits[1].distance);
    }

    #[test]
    fn duplicate_vector_ids_fail_closed() {
        let table = table();
        table.add(10, &[1.0, 0.0, 0.0, 0.0]).unwrap();
        let error = table.add(10, &[0.0, 1.0, 0.0, 0.0]).unwrap_err();
        assert!(error.to_string().contains("VECTOR_ID_COLLISION"));
    }

    #[test]
    fn dimension_and_nonfinite_inputs_are_rejected() {
        let table = table();
        assert!(table.add(10, &[1.0, 0.0]).is_err());
        assert!(table.add(11, &[1.0, f32::NAN, 0.0, 0.0]).is_err());
        assert!(table.search(&[1.0, 0.0], 1).is_err());
    }

    #[test]
    fn sealed_memtable_remains_query_visible_but_not_writable() {
        let table = table();
        table.add(10, &[1.0, 0.0, 0.0, 0.0]).unwrap();
        table.seal().unwrap();
        assert_eq!(table.state().unwrap(), MemTableState::SealedQueryVisible);
        assert!(table.add(11, &[0.0, 1.0, 0.0, 0.0]).is_err());
        assert_eq!(table.search(&[1.0, 0.0, 0.0, 0.0], 1).unwrap().len(), 1);
    }

    #[test]
    fn lifecycle_preserves_query_visibility_until_reclaimable() {
        let table = table();
        table.add(10, &[1.0, 0.0, 0.0, 0.0]).unwrap();
        table.seal().unwrap();
        table.begin_flush().unwrap();
        table.mark_segment_published().unwrap();
        table.mark_retired_query_visible().unwrap();
        assert_eq!(table.search(&[1.0, 0.0, 0.0, 0.0], 1).unwrap().len(), 1);
        table.mark_reclaimable().unwrap();
        assert!(table.search(&[1.0, 0.0, 0.0, 0.0], 1).is_err());
    }

    #[test]
    fn exact_recovery_bytes_roundtrip() {
        let vector = vec![1.0_f32, -2.5, 3.25, 4.0];
        let bytes = encode_f32_le(&vector).unwrap();
        let decoded = decode_f32_le(&bytes, 4).unwrap();
        assert_eq!(decoded, vector);

        let table = table();
        table.hydrate_f32_le(&[(42, bytes)]).unwrap();
        assert!(table.contains(42).unwrap());
    }

    #[test]
    fn supports_full_positive_signed_i64_keyspace() {
        let table = table();
        table.add(i64::MAX, &[1.0, 0.0, 0.0, 0.0]).unwrap();
        assert!(table.contains(i64::MAX).unwrap());
    }
}
