import Markdown from 'react-markdown';
import { planSections, readProposalPlan } from './proposal-plan';

function PlanText({ text }: { text: string }) {
  return (
    <div className="space-y-2 break-words text-sm leading-6 [&_a]:text-accent [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      <Markdown skipHtml disallowedElements={['img']}>{text}</Markdown>
    </div>
  );
}

export function ProposalPlan({ plan }: { plan: string }) {
  const sections = readProposalPlan(plan);
  if (!sections.structured) {
    return <div className="rounded-xl bg-panel p-4"><PlanText text={plan} /></div>;
  }
  return (
    <div className="grid gap-3">
      {planSections.map(({ key, title }) => (
        <section key={key} className="rounded-xl border border-line bg-panel/60 p-4">
          <h4 className="mb-2 text-sm font-bold text-accent">{title}</h4>
          <PlanText text={sections[key]} />
        </section>
      ))}
    </div>
  );
}
