import {Divide} from '@airgen/ui';

export function DivideExample() {
  return (
    <>
      <p>Overview</p>
      <Divide />
      <div style={{display: 'flex', gap: 8}}>
        <span>Projects</span>
        <Divide direction="vertical" />
        <span>Tasks</span>
      </div>
    </>
  );
}
