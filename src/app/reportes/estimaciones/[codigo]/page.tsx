import EstimacionDetallePage from '@/views/EstimacionDetallePage';

export default async function Page({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  return <EstimacionDetallePage codigo={decodeURIComponent(codigo)} />;
}
