import TarifarioFormPage from '@/views/TarifarioFormPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TarifarioFormPage modo="editar" id={decodeURIComponent(id)} />;
}
