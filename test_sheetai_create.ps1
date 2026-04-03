$body = '{\"title\":\"Nova_测试工作簿_001\"}
try {
    $result = Invoke-RestMethod -Uri "http://localhost:6005/admin_api/sheetai/workbooks" -Method Post -Body $body -ContentType "application/json"
    Write-Host "SUCCESS: Workbook created!"
    Write-Host $result
} catch {
    Write-Host "ERROR: $_"
    exit 1
}