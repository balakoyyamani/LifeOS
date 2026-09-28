---
name: Generated client DOM iterable typing
description: TypeScript configuration required by generated fetch helpers in this workspace.
---

Generated API client code calls `Headers.entries()`, so the client library TypeScript `lib` list must include both `dom` and `dom.iterable`.

**Why:** Without `dom.iterable`, API codegen succeeds but the workspace library typecheck fails on the generated fetch helper.

**How to apply:** Preserve `dom.iterable` whenever changing or regenerating `lib/api-client-react`.