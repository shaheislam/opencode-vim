/** @jsxImportSource @opentui/solid */
import { RenderableEvents, TextareaRenderable } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import { expect, test } from "bun:test"
import { EventEmitter } from "node:events"
import { createSignal, onCleanup } from "solid-js"
import { configurePromptListeners } from "../src/component/prompt/listeners"
import { OpencodeKeymapProvider, registerOpencodeKeymap, useBindings } from "../src/keymap"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"

test("prompt binding listeners stay bounded through updates and target replacement", async () => {
  let setTarget: (value: TextareaRenderable | undefined) => void = () => {}
  let toggleEnabled = () => {}
  const defaultLimit = new EventEmitter().getMaxListeners()

  function Harness() {
    const [target, updateTarget] = createSignal<TextareaRenderable>()
    const [enabled, setEnabled] = createSignal(true)
    setTarget = updateTarget
    toggleEnabled = () => setEnabled((value) => !value)
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    onCleanup(registerOpencodeKeymap(keymap, renderer, createTuiResolvedConfig()))
    function Bindings() {
      // The prompt has twelve local layers plus the managed textarea layer.
      for (let index = 0; index < 12; index++) {
        useBindings(() => ({ target, enabled: enabled(), bindings: [{ key: "f1", cmd: () => {} }] }))
      }
      return <box />
    }
    return (
      <OpencodeKeymapProvider keymap={keymap}>
        <Bindings />
      </OpencodeKeymapProvider>
    )
  }

  const app = await testRender(() => <Harness />)
  try {
    await app.renderOnce()
    for (let round = 0; round < 20; round++) {
      const input = new TextareaRenderable(app.renderer, { id: `prompt-${round}` })
      configurePromptListeners(input)
      app.renderer.root.add(input)
      input.focus()
      const baseline = input.listenerCount(RenderableEvents.DESTROYED)
      setTarget(input)
      const count = input.listenerCount(RenderableEvents.DESTROYED)
      expect(count).toBe(baseline + 12)
      expect(count).toBeLessThanOrEqual(input.getMaxListeners())
      expect(input.getMaxListeners()).toBeLessThanOrEqual(20)
      expect(input.getMaxListeners()).toBeGreaterThan(0)

      for (let update = 0; update < 20; update++) {
        toggleEnabled()
        expect(input.listenerCount(RenderableEvents.DESTROYED)).toBe(count)
      }

      setTarget(undefined)
      expect(input.listenerCount(RenderableEvents.DESTROYED)).toBe(baseline)
      input.destroy()
      expect(input.listenerCount(RenderableEvents.DESTROYED)).toBe(0)
    }
    expect(new EventEmitter().getMaxListeners()).toBe(defaultLimit)
  } finally {
    setTarget(undefined)
    app.renderer.destroy()
  }
})
