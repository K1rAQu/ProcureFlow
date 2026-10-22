import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasAnyPermission,
  hasPermission,
  isValidPermission,
  PERMISSIONS,
  ROLE_PRESETS,
} from "../src/lib/permissions.ts";

test("адміністратор володіє всіма правами", () => {
  const admin = ROLE_PRESETS.find((role) => role.code === "admin");
  assert.ok(admin);
  assert.equal(admin.permissions.length, PERMISSIONS.length);
});

test("звичайний користувач не може адмініструвати та бачити чужі заявки", () => {
  const user = ROLE_PRESETS.find((role) => role.code === "user");
  assert.ok(user);
  assert.equal(hasPermission(user.permissions, "requests.create"), true);
  assert.equal(hasPermission(user.permissions, "requests.view_all"), false);
  assert.equal(hasPermission(user.permissions, "admin.users"), false);
  assert.equal(hasPermission(user.permissions, "nomenclature.archive"), false);
});

test("роль відповідального за цех бачить заявки свого цеху", () => {
  const lead = ROLE_PRESETS.find((role) => role.code === "workshop_lead");
  assert.ok(lead);
  assert.equal(hasPermission(lead.permissions, "requests.view_workshop"), true);
  assert.equal(hasPermission(lead.permissions, "requests.view_all"), false);
});

test("перевірка набору прав та валідності коду", () => {
  assert.equal(hasAnyPermission(["admin.users"], ["admin.roles", "admin.users"]), true);
  assert.equal(hasAnyPermission([], ["admin.users"]), false);
  assert.equal(hasPermission(null, "admin.users"), false);
  assert.equal(isValidPermission("requests.create"), true);
  assert.equal(isValidPermission("requests.delete_everything"), false);
});
