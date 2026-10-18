import {Caret} from '@airgen/ui';

// Decorative indicators; provide accessible names on their containing controls.
export function CaretExample() {
  return (
    <>
      <Caret direction="right" />
      <Caret open />
      <Caret variant="triangle" size="sm" />
    </>
  );
}
