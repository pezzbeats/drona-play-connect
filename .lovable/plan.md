
## Plan: Replace HTML Widget with React SDK Integration

### What's changing
- Remove the `<elevenlabs-convai>` HTML widget and `<script>` tag from `index.html`
- Install `@elevenlabs/react` npm package
- Create a new `src/components/VoiceAgent.tsx` React component using the `useConversation` hook
- Mount it globally in `src/App.tsx` alongside the Toasters

### Component design
The floating button will:
- Fixed bottom-right (matching the old widget position)
- Mic icon button — one tap to start, another to stop
- Show a subtle "speaking / listening" indicator when active
- Request microphone permission before starting
- Connect via WebRTC with `agentId: "agent_2101kk1n1zmfezxswwp4xxf5d0ew"` (public agent, no server token needed)
- Match the app's existing dark/glass aesthetic (transparent dark background, gold accent)

### Files touched
1. `index.html` — remove lines 29–30 (widget tag + CDN script)
2. `package.json` — add `@elevenlabs/react` dependency
3. `src/components/VoiceAgent.tsx` — new floating mic button component
4. `src/App.tsx` — import and render `<VoiceAgent />` at the top level

### Technical notes
- Uses `connectionType: "webrtc"` for lower latency (same as React SDK docs recommend)
- No API key or edge function needed for a public agent
- Microphone permission is requested on first tap with a clear UX state (idle → connecting → connected)
- `conversation.status` drives button state: `disconnected` = mic off, `connected` = mic live with pulse animation
