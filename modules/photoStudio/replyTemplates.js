const TONE_PRESETS = Object.freeze({
    formal: {
        greeting: (name) => `${name}，您好。`,
        closing: '如您确认无误，我会继续按这个安排推进。',
        signature: '谢谢。'
    },
    friendly: {
        greeting: (name) => `${name}，你好。`,
        closing: '如果你这边方便，直接回复我就行，我会继续往下安排。',
        signature: '辛苦啦。'
    },
    warm: {
        greeting: (name) => `${name}，你好呀。`,
        closing: '如有需要调整的地方，也可以直接告诉我，我这边会同步处理。',
        signature: '期待这次合作。'
    }
});

function buildContextIntro(contextType, project) {
    switch (contextType) {
    case 'quotation':
        return [
            `关于项目“${project.project_name}”，我先把当前报价沟通口径整理给你。`,
            `项目类型是 ${project.project_type}，我会按这个方向继续细化方案。`
        ];
    case 'schedule':
        return [
            `关于项目“${project.project_name}”，我和你确认一下当前排期安排。`,
            project.start_date ? `目前记录的开始日期是 ${project.start_date}。` : '开始日期这边还可以继续确认。'
        ];
    case 'delivery':
        return [
            `项目“${project.project_name}”的交付准备已经在推进中了。`,
            project.due_date ? `当前记录的交付日期是 ${project.due_date}。` : '如果你对交付时间有要求，也可以直接告诉我。'
        ];
    case 'general':
    default:
        return [
            `我来跟进一下项目“${project.project_name}”的当前安排。`,
            `项目目前状态是 ${project.status}。`
        ];
    }
}

function buildReplyDraft({ customerName, project, contextType, tone, keyPoints }) {
    const preset = TONE_PRESETS[tone];
    const lines = [
        preset.greeting(customerName),
        '',
        ...buildContextIntro(contextType, project)
    ];

    if (Array.isArray(keyPoints) && keyPoints.length > 0) {
        lines.push('', '补充说明：');
        keyPoints.forEach((point) => {
            lines.push(`- ${point}`);
        });
    }

    lines.push('', preset.closing, preset.signature);

    return lines.join('\n');
}

module.exports = {
    buildReplyDraft
};
