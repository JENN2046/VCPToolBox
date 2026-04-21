function buildArchiveAssetDescription({
    archiveLabel,
    archiveMode,
    archivePath,
    assetSummary,
    customerName,
    note,
    project
}) {
    const lines = [
        `Project: ${project.project_name}`,
        `Customer: ${customerName}`,
        `Project status: ${project.status}`,
        `Archive label: ${archiveLabel}`,
        `Archive mode: ${archiveMode}`,
        `Archive path: ${archivePath}`
    ];

    if (assetSummary) {
        lines.push(`Asset summary: ${assetSummary}`);
    }

    if (note) {
        lines.push(`Note: ${note}`);
    }

    return lines.join('\n');
}

module.exports = {
    buildArchiveAssetDescription
};
