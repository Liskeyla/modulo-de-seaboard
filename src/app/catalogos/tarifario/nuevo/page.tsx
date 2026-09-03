import TarifarioFormPage from '@/views/TarifarioFormPage';
import { TIPOS_TARIFA, type TipoTarifa } from '@/types/tarifario';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const sp = await searchParams;
  const raw = (sp.tipo ?? 'BOX').toUpperCase();
  const tipo: TipoTarifa = (TIPOS_TARIFA as readonly string[]).includes(raw)
    ? (raw as TipoTarifa)
    : 'BOX';
  return <TarifarioFormPage modo="nuevo" tipoInicial={tipo} />;
}
