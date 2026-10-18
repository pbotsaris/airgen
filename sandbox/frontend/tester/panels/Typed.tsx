/**
 * The typed API against this base, written the way a consumer would. This
 * file is what the daemon's typecheck guards: every `@ts-expect-error` below
 * must be a real error, so the observer's "types ok" badge doubles as the
 * compile-time test of include's rules (depth, cycles, dangling links).
 * Regenerating against a different set of granted tables can break it; that
 * is the codemod/diagnostics path doing its job.
 */
import React from 'react';
import {cellNames, firstLinkedRecord, lookupValues} from 'airgen/interface';
import {RecordTable, type RecordTableColumn} from '@airgen/ui';
import type {TypedRecord} from 'airgen/interface';
import {useFields, useQuery, useRecords, type TableRecordMap} from '../../airtable-schema';
import {Code, Section} from '../kit';

type Conta = TypedRecord<TableRecordMap, 'PlanoDeContas'>;

export function compileTimeRules() {
  // Depth 2 along a path with no repeats: Plano → categoria → grupos.
  useRecords('PlanoDeContas', {include: {grupo: true, categoria: {grupos: true}}});
  // @ts-expect-error a cycle: categoria → contas leads back to PlanoDeContas
  useRecords('PlanoDeContas', {include: {categoria: {contas: true}}});
  // @ts-expect-error depth 3 is over the limit
  useRecords('GruposDeContas', {include: {planoDeContas: {categoria: {grupos: true}}}});
  // @ts-expect-error naturezaLink points at a table not granted to the extension
  useRecords('GruposDeContas', {include: {naturezaLink: true}});
  // @ts-expect-error not a link field
  useRecords('PlanoDeContas', {include: {nome: true}});
  // @ts-expect-error excess key, nested
  useRecords('PlanoDeContas', {include: {categoria: {nope: true}}});
}

export function Typed() {
  const contas = useRecords('PlanoDeContas', {include: {grupo: true, categoria: {grupos: true}}});
  const tagged = useQuery('CategoriasDeContas', {where: [{field: 'tag', op: 'notEmpty'}], include: {contas: true}});
  const fields = useFields('CategoriasDeContas');
  const plain = useRecords('PlanoDeContas');

  const columns: RecordTableColumn<Conta>[] = [
    {id: 'nome', header: 'Conta'},
    {id: 'grupo', header: 'Grupo (stub)'},
    {id: 'grupoTag', header: 'Grupo tag (lookup)'},
    {id: 'summary', header: 'helpers', accessor: r => `${cellNames(r.fields.grupo).join('/')} · ${lookupValues(r.fields.grupoTag).join('/')} · first: ${firstLinkedRecord(r.fields.categoria)?.name ?? '—'}`},
  ];

  return (
    <>
      <Section title="Typed include, two deep" hint={<>useRecords('PlanoDeContas', {'{'}include: {'{'}grupo: true, categoria: {'{'}grupos: true{'}}}'})</>}>
        <ul className="m-0 pl-4">
          {contas.slice(0, 12).map(conta => (
            <li key={conta.id}>
              <strong>{conta.name}</strong>
              {' · grupo: '}
              {conta.fields.grupo?.map(g => g.fields.nome).join(', ') || '—'}
              {' · categoria: '}
              {conta.fields.categoria
                ?.map(c => `${c.fields.name ?? c.name} [${c.fields.tag?.name ?? 'no tag'}] → grupos ${c.fields.grupos?.map(g => g.name).join(', ') || '—'}`)
                .join('; ') || '—'}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Typed useQuery + include" hint={<>Categorías with a tag, each with its contas hydrated. Tag choices live from <Code>useFields</Code>: {fields.tag.choices.length}.</>}>
        <ul className="m-0 pl-4">
          {tagged.slice(0, 12).map(cat => (
            <li key={cat.id}>
              {cat.name} [{cat.fields.tag?.name}]: {cat.fields.contas?.length ?? 0} contas ({cat.fields.contas?.slice(0, 4).map(c => c.fields.nome).join(', ')})
            </li>
          ))}
        </ul>
      </Section>
      <Section title="RecordTable with typed columns" hint="Column ids autocomplete from PlanoDeContasRecord; the last one is a derived accessor.">
        <RecordTable records={plain.slice(0, 15)} columns={columns} />
      </Section>
    </>
  );
}
