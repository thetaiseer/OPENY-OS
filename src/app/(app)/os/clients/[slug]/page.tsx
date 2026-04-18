import { StandardPage } from '@/new-ui/page-composition';
export default function Page({ params }: { params: { slug: string } }) {
  return <StandardPage title={`Client · ${params.slug}`} subtitle="Client detail workspace for projects, assets, and operations." tableName="Client Detail" />;
}
