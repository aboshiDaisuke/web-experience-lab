import { notFound } from 'next/navigation';
import { projects } from '@/lib/portfolio';
import ProjectExperience from '@/components/project-experience';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = projects.find((x) => x.slug === slug);
  return { title: p ? `${p.name} — ${p.category}` : '作品が見つかりません' };
}
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) notFound();
  return <ProjectExperience project={project} />;
}
