"use client";
import { useActionState } from "react";
import { loginAction } from "@/actions/common";
import { Button, Field, Input, Notice } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="मोबाइल / Mobile">
        <Input name="mobile" inputMode="numeric" autoComplete="username" autoFocus required />
      </Field>
      <Field label="पासवर्ड / Password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      {state?.error ? <Notice kind="error">{state.error}</Notice> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "…" : "लॉगिन / Log in"}
      </Button>
    </form>
  );
}
