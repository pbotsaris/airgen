import {Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow} from '@airgen/ui';

// Resizing requires one header row, no row/column spans and no custom colgroup.
// Drag handles or use Left/Right (10px), Shift+Left/Right (50px), Home/End.
export function TableExample() {
  return (
    <Table resizable columnLines>
      <TableCaption>Project hours</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead minWidth={120} maxWidth={400}>
            Project
          </TableHead>
          <TableHead resizable={false}>Hours</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Website</TableCell>
          <TableCell>12</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell>12</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
