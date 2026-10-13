// Generated from the pinned document by scripts/api.ts: the permission each documented operation
// names, with the kernel's own flag for a grant held only by the installation's operator and the
// surface that asks for it. No permission outside the document is added, and none it names is
// dropped: this is what a caller may ask a key to be narrowed to.
export interface DeclaredGrant {
  readonly permission: string;
  readonly operator: boolean;
  readonly surface: string;
}
export const declaredGrants: readonly DeclaredGrant[] = [
  { permission: "audit:read", operator: false, surface: "app" },
  { permission: "billing:catalog", operator: true, surface: "ops" },
  { permission: "billing:manage", operator: false, surface: "app" },
  { permission: "billing:read", operator: false, surface: "app" },
  { permission: "change:decide", operator: false, surface: "app" },
  { permission: "change:propose", operator: false, surface: "app" },
  { permission: "change:read", operator: false, surface: "app" },
  { permission: "content:manage", operator: false, surface: "app" },
  { permission: "content:read", operator: false, surface: "app" },
  { permission: "file:erase", operator: false, surface: "app" },
  { permission: "file:manage", operator: false, surface: "app" },
  { permission: "file:read", operator: false, surface: "app" },
  { permission: "file:retain", operator: false, surface: "app" },
  { permission: "passkey:signin", operator: false, surface: "app" },
  { permission: "role:manage", operator: false, surface: "app" },
  { permission: "site:manage", operator: false, surface: "app" },
  { permission: "task:read", operator: false, surface: "app" },
  { permission: "task:update", operator: false, surface: "app" },
  { permission: "tenant:manage", operator: true, surface: "ops" },
  { permission: "user:approve", operator: false, surface: "app" },
  { permission: "user:manage", operator: false, surface: "app" },
  { permission: "user:read", operator: false, surface: "app" },
  { permission: "webhook:read", operator: false, surface: "app" },
  { permission: "webhook:update", operator: false, surface: "app" },
];
