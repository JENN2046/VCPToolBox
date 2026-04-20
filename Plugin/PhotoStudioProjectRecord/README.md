# PhotoStudioProjectRecord

Creates the shared `photo_studio` project record and guarantees the record is anchored to an existing `customer_id`.

## Command

- `create_project_record`

## Input

```json
{
  "customer_id": "cust_20260420_ab12cd34",
  "project_name": "Spring Portrait Session",
  "project_type": "portrait",
  "shoot_date": "2026-05-02",
  "location": "Shanghai West Bund",
  "style_keywords": ["natural light", "editorial"],
  "reference_links": ["https://example.com/reference-board"],
  "delivery_deadline": "2026-05-10",
  "notes": "Outdoor look with two wardrobe changes."
}
```

## Output

```json
{
  "success": true,
  "data": {
    "project_id": "proj_20260420_ab12cd34",
    "created": true,
    "duplicate": false,
    "status": "pending_preparation",
    "project": {}
  },
  "error": null,
  "meta": {
    "command": "create_project_record",
    "entity": "project"
  }
}
```

## Runtime Data

Default store location:

- `data/photo-studio/projects.json`

## Notes

- `customer_id` must already exist in the shared customer store.
- Duplicate protection uses `customer_id + normalized project_name + normalized project_type`.
- New records always start with status `pending_preparation`.
