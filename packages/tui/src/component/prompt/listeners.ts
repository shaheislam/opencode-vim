import type { TextareaRenderable } from "@opentui/core"

export function configurePromptListeners(input: TextareaRenderable) {
  // Twelve prompt keymap layers and the managed textarea layer each watch destruction.
  input.setMaxListeners(20)
}
