'use strict';

// Use the host's real HTTP execution path. Do not emulate Express req/res or
// accept a channel-supplied upstream URL/key.
class HostRuntime {
    constructor({ agentManager, agents = {}, model, timeoutMs = 120000 }) {
        this.agentManager = agentManager;
        this.agents = agents;
        this.model = model;
        this.timeoutMs = timeoutMs;
        this.endpoint = null;
        this.pending = new Set();
        this.controllers = new Set();
        this.draining = false;
    }

    setEndpoint({ url, key }) {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1' || parsed.pathname !== '/v1/chat/completions' || parsed.search || parsed.hash || parsed.username || parsed.password || !key) throw new Error('INVALID_CHANNELHUB_HOST_ENDPOINT');
        this.endpoint = { url: parsed.href, key };
    }

    invoke(envelope, route) {
        if (this.draining || !this.endpoint) return Promise.reject(new Error('CHANNELHUB_RUNTIME_NOT_READY'));
        const operation = this.execute(envelope, route);
        this.pending.add(operation);
        operation.finally(() => this.pending.delete(operation)).catch(() => {});
        return operation;
    }

    async execute(envelope, route) {
        const configured = this.agents[route.agentId];
        const alias = configured?.agentAlias || route.agentId;
        const model = configured?.model || this.model;
        if (!alias || !this.agentManager.isAgent(alias) || !model) throw new Error('CHANNELHUB_AGENT_OR_MODEL_NOT_CONFIGURED');
        const prompt = await this.agentManager.getAgentPrompt(alias);
        if (typeof prompt !== 'string' || !prompt.trim()) throw new Error('CHANNELHUB_AGENT_PROMPT_UNAVAILABLE');
        if (this.draining) throw new Error('CHANNELHUB_DRAINING');
        const controller = new AbortController();
        this.controllers.add(controller);
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const response = await fetch(this.endpoint.url, {
                method: 'POST', redirect: 'error', signal: controller.signal,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.endpoint.key}` },
                body: JSON.stringify({ model, stream: false,
                    messages: [{ role: 'system', content: prompt }, ...(envelope.payload?.messages || []).map(message => ({ role: 'user', content: message.content }))],
                    requestId: envelope.requestId || envelope.eventId,
                    _channelHubRequest: true })
            });
            if (!response.ok) throw new Error(`CHANNELHUB_HOST_HTTP_${response.status}`);
            const result = await response.json();
            const content = result.choices?.[0]?.message?.content;
            if (result.error || typeof content !== 'string' || !content.trim()) throw new Error('CHANNELHUB_HOST_INVALID_REPLY');
            return { messages: [{ role: 'assistant', content: [{ type: 'text', text: content }] }],
                toolEvents: [], usage: result.usage || null,
                topic: { resolvedTopicId: route.topicId || null } };
        } finally {
            clearTimeout(timer);
            this.controllers.delete(controller);
        }
    }

    beginDrain() {
        this.draining = true;
        for (const controller of this.controllers) controller.abort();
    }

    async close() {
        this.beginDrain();
        await Promise.allSettled([...this.pending]);
        this.endpoint = null;
    }
}

module.exports = { HostRuntime };
