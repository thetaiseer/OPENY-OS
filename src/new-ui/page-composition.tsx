import { ActionMenu, DemoModal, Tabs } from '@/new-ui/interactive';
import { EmptyState, FilterBar, PageHeader, Section, SimpleTable, StatGrid } from '@/new-ui/primitives';

export function StandardPage({
  title,
  subtitle,
  tableName,
}: {
  title: string;
  subtitle: string;
  tableName: string;
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={<div style={{ display: 'flex', gap: 8 }}><DemoModal /><ActionMenu /></div>}
      />
      <StatGrid
        items={[
          { label: 'Active', value: '128' },
          { label: 'Pending', value: '34' },
          { label: 'Blocked', value: '9' },
          { label: 'Velocity', value: '+18%' },
        ]}
      />
      <Section>
        <h3 style={{ marginTop: 0 }}>{tableName} Filters</h3>
        <FilterBar />
      </Section>
      <Section>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>{tableName}</h3>
          <Tabs items={['Overview', 'Board', 'Timeline']} />
        </div>
        <SimpleTable
          headers={['Name', 'Owner', 'Status', 'Updated']}
          rows={[
            ['Atlas', 'Mina', 'In Progress', 'Today'],
            ['Pulse', 'Rayan', 'Review', 'Yesterday'],
            ['Helix', 'Sara', 'Completed', '2d ago'],
          ]}
        />
      </Section>
      <Section>
        <EmptyState title="No blockers" message="This zone is reserved for alerts, incidents, and edge-case fallbacks." />
      </Section>
    </>
  );
}
