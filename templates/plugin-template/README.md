# Project-Mind Plugin Template

This template allows you to quickly build and test custom heuristic plugins for Project-Mind. 

## 1. Installation & Build

```bash
npm install
npm run build
```
This compiles your plugin via `tsup` into the `dist/` directory.

## 2. Testing Locally

Before distributing your plugin, you should test it locally against an example fixture. 

First, ensure your plugin is built:
```bash
npm run build
```

Then, you can link it or test it directly. Because Project-Mind has a **Zero-Trust Security Policy**, it will block local plugins by default. You must explicitly trust your plugin hash:

```bash
# Point Project-Mind to your compiled plugin file
project-mind plugin trust ./dist/index.js
```

Once trusted, you can add it to your project's `.project-mind/authored/plugins.json`:
```json
{
  "installed": [
    {
      "name": "my-project-mind-plugin",
      "version": "1.0.0",
      "enabled": true,
      "path": "./dist/index.js"
    }
  ]
}
```

Now, when you run `project-mind update` in your fixture folder, it will load and execute your plugin!

## 3. Writing Tests

The template comes with `vitest`. You can write unit tests inside `tests/` by mocking the `PluginContext` object and verifying the extracted `PluginContribution`.

```bash
npm test
```
