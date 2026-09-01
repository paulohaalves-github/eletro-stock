"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { Button, Input, Label } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("admin@eletromall.com");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await api("/api/auth/login", { method: "POST", json: { email, password } });
      toast.success("Sessão iniciada.");
      router.replace(params.get("next") || "/");
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
      <div className="card glow-border w-full max-w-md p-8">
        <div className="mb-8 flex items-center gap-3">
          <img src="/logo.svg" alt="" className="h-12 w-12" />
          <div>
            <p className="text-lg font-semibold tracking-wide">ELETRO-STOCK</p>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Outlet Eletromall</p>
          </div>
        </div>
        <h1 className="text-2xl font-semibold">Acesso ao estoque</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Controle individual, rastreável e rápido.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <p className="mt-6 text-xs text-muted">Demonstração: admin@eletromall.com · Admin@123</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
