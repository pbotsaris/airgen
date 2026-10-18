import {RecordCellValue} from '@airgen/ui';

export function RecordCellValueExample() {
  return (
    <>
      <RecordCellValue value={{name: 'Done', color: 'greenBright'}} />
      <RecordCellValue value={[{id: 'rec1', name: 'Website'}]} />
      <RecordCellValue value={null} />
    </>
  );
}
