# Camera Runner

Cyber-minimal endless runner controlled by your laptop camera.

## Quick start

```
pnpm i && pnpm dev
```

Open `http://localhost:3000` and follow the calibration overlay.
The MoveNet Thunder model is served locally from `public/models/movenet` to avoid CORS issues.

## Camera permissions

- **Chrome**: click the camera icon in the address bar → Allow. If blocked, go to Settings → Privacy and security → Site settings → Camera.
- **Firefox**: click the camera icon in the address bar → Allow. If blocked, go to Settings → Privacy & Security → Permissions → Camera.

## Keyboard fallback

If the camera is unavailable, the game automatically switches to keyboard:
- Space = jump
- Up/Down = flap rhythm

## PWA build

```
pnpm build && pnpm start
```

## Static export + Docker (nginx)

```
pnpm build && pnpm export
```

```
docker build -t camera-runner .
docker run -p 8080:80 camera-runner
```

## Tests

```
pnpm test
pnpm test:e2e
```
