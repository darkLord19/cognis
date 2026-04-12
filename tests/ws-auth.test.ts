import { expect, test } from "bun:test";
import { authenticateOperator } from "../server/ws/auth";

test("authenticateOperator: denies elevation when no server token is configured", () => {
  expect(authenticateOperator("anything", undefined)).toBe(false);
});

test("authenticateOperator: denies elevation when token does not match", () => {
  expect(authenticateOperator("wrong-token", "expected-token")).toBe(false);
});

test("authenticateOperator: allows elevation when token matches", () => {
  expect(authenticateOperator("expected-token", "expected-token")).toBe(true);
});
