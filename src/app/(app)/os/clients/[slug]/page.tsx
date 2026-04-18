import { StandardPage } from '@/new-ui/page-composition';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StandardPage title={`Client · ${slug}`} subtitle="Client detail workspace for projects, assets, and operations." tableName="Client Detail" />;
}
