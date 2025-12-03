# Mona Web - Frontend

Next.js frontend for Project Mona with real-time WebSocket chat interface and a reactive 3D avatar room.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Real-time WebSocket chat connection
- Message history with timestamps
- Typing indicators
- Responsive chat UI with animations
- Connection status indicator
- Reactive holographic room driven by Mona's emotion payloads
- Three.js scene scaffolded with react-three-fiber for future VRM avatar
- Streaming chat UI that renders GPT tokens chunk-by-chunk

## Project Structure

```
mona-web/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles
├── components/
│   ├── AvatarPanel.tsx     # 3D hologram & room visualization
│   ├── ChatInterface.tsx   # Main chat component
│   ├── ChatMessage.tsx     # Individual message component
│   └── TypingIndicator.tsx # Typing animation
├── hooks/
│   └── useWebSocket.ts     # WebSocket custom hook
└── types/
    └── chat.ts             # TypeScript types
```

## Requirements

- Node.js 18+
- mona-brain backend running on port 8000

## Configuration

- `NEXT_PUBLIC_VRM_URL` – optional URL/path to a `.vrm` avatar streamed into the hologram (defaults to `/avatars/Mona1.vrm` for local testing)

## Week 4 Additions

- Emotion stream is rendered inside the new hologram panel
- Added three.js + react-three-fiber + drei dependencies
- Updated chat layout to sit alongside the room preview on desktop
- Streaming message handling with graceful fallbacks when the LLM chunks tokens
- Bundled placeholder VRM (`public/avatars/Mona1.vrm`) so the hologram renders a character out-of-the-box
