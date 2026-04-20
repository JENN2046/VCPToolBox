# PhotoStudioCustomerRecord

Creates the shared `photo_studio` customer record used by downstream project, task, and reply plugins.

## Command

- `create_customer_record`

## Input

```json
{
  "customer_name": "Luna Studio",
  "brand_name": "Luna",
  "contact_method": "wechat",
  "contact_value": "luna-photo",
  "source_channel": "xiaohongshu",
  "project_type": "brand",
  "budget_range": "10k-20k",
  "notes": "First consultation completed."
}
```

## Output

```json
{
  "success": true,
  "data": {
    "customer_id": "cust_20260420_ab12cd34",
    "created": true,
    "duplicate": false,
    "customer": {}
  },
  "error": null,
  "meta": {
    "command": "create_customer_record",
    "entity": "customer"
  }
}
```

## Runtime Data

Default store location:

- `data/photo-studio/customers.json`

## Notes

- Duplicate protection uses normalized contact data first, then customer name plus brand plus contact value.
- Errors follow the shared `photo_studio` P0 error code contract in `/docs/photo_studio_p0_schema_contract.md`.
