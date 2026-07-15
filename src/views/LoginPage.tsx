'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ClipboardCheck, FileSpreadsheet, Lock, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/store';

export default function LoginPage() {
  const [username, setUsername] = useState('apptelink');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      const rol =
        username.toLowerCase() === 'seaboard' ? '/aprobaciones/seaboard' : '/reportes/estimaciones';
      router.push(rol);
    } catch {
      setError('Credenciales inválidas. Use apptelink o seaboard / admin123');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-2xl lg:grid-cols-2">
        <div className="dms-login-panel">
          <div>
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <h2 className="text-2xl font-bold">RFS DMS Ecuador</h2>
            <p className="mt-2 text-sm text-white/80">
              Prototipo de estimaciones y aprobaciones Seaboard para revisión operativa y auditoría.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rfs-orange" />
              Reporte de estimaciones con filtros y exportación
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rfs-orange" />
              Flujo de estados PENDIENTE → ENVIADO → APROBADO
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-rfs-orange" />
              Aprobaciones Seaboard con comentarios
            </li>
          </ul>
        </div>

        <Card className="border-0 shadow-none">
          <CardContent className="flex flex-col justify-center p-8 md:p-10">
            <div className="mb-8 flex flex-col items-center gap-3">
              <Image
                src="/img/rfs-logo.jpg"
                alt="RFS"
                width={160}
                height={50}
                className="h-12 w-auto"
                priority
              />
              <h1 className="text-xl font-bold text-rfs-navy">Iniciar sesión</h1>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                Prototipo · Datos simulados
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <User className="h-3.5 w-3.5" /> Usuario
                </label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="rounded-lg"
                />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <Lock className="h-3.5 w-3.5" /> Contraseña
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="rounded-lg"
                />
              </div>
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">
                  {error}
                </p>
              )}
              <Button type="submit" className="dms-btn-primary w-full" disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar al sistema'}
              </Button>
            </form>

            <div className="mt-6 space-y-2 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-3 text-xs text-[#31708f]">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" /> Usuarios demo
              </p>
              <p>
                <strong>apptelink</strong> / admin123 — Reporte DMS
              </p>
              <p>
                <strong>seaboard</strong> / admin123 — Aprobaciones
              </p>
            </div>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-gray-400">
              <FileSpreadsheet className="h-3 w-3" /> Flujo sincronizado en memoria local
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
