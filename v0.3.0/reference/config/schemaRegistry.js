// we would need code generation here to generate the types. we need to build this

import { FieldType, Table, Field } from '@airtable/blocks/interface/models'

/** @typedef {Object} SchemaTables
 * @property {Table|null} deals
 * @property {Table|null} estimates
 * @property {Table|null} stages
 * @property {Table|null} studios
 * @property {Table|null} organizations
 * @property {Table|null} scenarios
 * @property {Table|null} serviceItems
 * @property {Table|null} licenseTermItems
 * @property {Table|null} services
 * @property {Table|null} licenseTerms
 * @property {Table|null} notes
 * @property {Table|null} noteItems
 * @property {Table|null} noteTemplates
 * @property {Table|null} [config]
 */

/** @typedef {Object} FieldDef
 * @property {string[]} aliases
 * @property {string[]} [types] - allowed FieldType values; empty = any type
 * @property {boolean} [required]
 * @property {boolean} [primary] - fall back to the table's primary field when no override/alias matches
 */

/** @typedef {Object} DealFields
 * @property {Field|null} stage
 * @property {Field|null} client
 * @property {Field|null} agency
 * @property {Field|null} contact
 * @property {Field|null} owner
 * @property {Field|null} prob
 * @property {Field|null} currencySymbol
 * @property {Field|null} totalBudget
 * @property {Field|null} weightedBudget
 * @property {Field|null} position
 * @property {Field|null} status
 * @property {Field|null} lostReason
 * @property {Field|null} lostReasonDetail
 * @property {Field|null} estimate
 * @property {Field|null} estimatingTo
 */

/** @typedef {Object} EstimateFields
 * @property {Field|null} deal
 * @property {Field|null} total
 * @property {Field|null} currencySymbol
 * @property {Field|null} date
 * @property {Field|null} status
 * @property {Field|null} template
 * @property {Field|null} templateId
 * @property {Field|null} scenarios
 * @property {Field|null} templateUrl
 * @property {Field|null} projectName
 * @property {Field|null} invoiceBy
 * @property {Field|null} noteItems
 */

/** @typedef {Object} StudioFields
 * @property {Field|null} country
 * @property {Field|null} addressLine1
 * @property {Field|null} addressLine2
 * @property {Field|null} addressLine3
 * @property {Field|null} registration
 * @property {Field|null} phone
 */

/** @typedef {Object} OrganizationFields
 * @property {Field|null} name
 * @property {Field|null} addressLine1
 * @property {Field|null} addressLine2
 * @property {Field|null} addressLine3
 * @property {Field|null} taxId
 * @property {Field|null} phone
 * @property {Field|null} country
 */

/** @typedef {Object} ScenarioFields
 * @property {Field|null} name
 * @property {Field|null} total
 * @property {Field|null} subTotal
 * @property {Field|null} licenseTermItems - links to the License Term Items table (the scenario's license line items)
 * @property {Field|null} discount
 * @property {Field|null} isApproved
 * @property {Field|null} order
 * @property {Field|null} description
 * @property {Field|null} showDescription
 * @property {Field|null} items
 */

/** @typedef {Object} ServiceItemFields
 * @property {Field|null} name
 * @property {Field|null} description
 * @property {Field|null} quantity
 * @property {Field|null} unitPrice
 * @property {Field|null} discount
 * @property {Field|null} referenceValue
 * @property {Field|null} currencySymbol - lookup of the linked scenario's `currencySymbol`; read-only
 * @property {Field|null} referenceDescription - lookup of the linked service's `description`; read-only
 * @property {Field|null} calculatedDiscount - formula field: `quantity * unitPrice * discount / 100`; read-only
 * @property {Field|null} currency
 * @property {Field|null} serviceId
 * @property {Field|null} position - number; sort key of the rows of one scenario, written by drag-and-drop
 * @property {Field|null} serviceType - lookup of the linked service's `type`; read-only
 * @property {Field|null} total
 *
 */

/**
 * A line item of a scenario created from a License Term (see LicenseTermFields), the
 * license counterpart of ServiceItemFields. Each descriptive attribute of the
 * linked term (media, duration, exclusivity, scope, territory) has a writable `*Override`
 * field here, which is what the estimate renders and edits. The term's own values (the
 * "reference") are read from the linked License Terms record, not from lookup fields —
 * lookups of selects can arrive as plain strings, losing the choice's id and color.
 *
 * @typedef {Object} LicenseTermItemFields
 * @property {Field|null} name
 * @property {Field|null} quantity
 * @property {Field|null} unitPrice
 * @property {Field|null} discount
 * @property {Field|null} calculatedDiscount - formula field: `quantity * unitPrice * discount / 100`; read-only
 * @property {Field|null} currencySymbol - lookup of the linked scenario's `currencySymbol`; read-only
 * @property {Field|null} currency
 * @property {Field|null} total
 * @property {Field|null} position - number; sort key of the rows of one scenario, written by drag-and-drop
 * @property {Field|null} licenseTermId - link to the License Terms table
 * @property {Field|null} mediaOverride - single line text
 * @property {Field|null} durationOverride - single line text
 * @property {Field|null} exclusivityOverride - single select
 * @property {Field|null} scopeOverride - single select
 * @property {Field|null} territoryOverride - multiple selects
 */

/** @typedef {Object} ServiceFields
 * @property {Field|null} name
 * @property {Field|null} description
 * @property {Field|null} value
 * @property {Field|null} currency
 * @property {Field|null} type
 */

/** @typedef {Object} LicenseTermFields
 * @property {Field|null} name
 * @property {Field|null} type
 * @property {Field|null} exclusivity
 * @property {Field|null} scope
 * @property {Field|null} duration
 * @property {Field|null} media
 * @property {Field|null} territory
 * @property {Field|null} currency
 * @property {Field|null} currencySymbol
 * @property {Field|null} referenceValue
 * @property {Field|null} formattedValue
 */

/** @typedef {Object} NoteFields
 * @property {Field|null} name
 * @property {Field|null} category
 * @property {Field|null} description
 * @property {Field|null} createdBy
 */

/** @typedef {Object} NoteItemFields
 * @property {Field|null} name
 * @property {Field|null} description - rich text; the item's override of the linked note's `description`
 * @property {Field|null} noteId - link to the Notes table
 * @property {Field|null} estimateId - link to the Estimates table
 * @property {Field|null} position - number; sort key of the rows of one estimate, written by drag-and-drop
 */

/** @typedef {Object} NoteTemplateFields
 * @property {Field|null} name
 * @property {Field|null} noteIds - links to the Notes table
 */

/** @typedef {Object} StageFields
 * @property {Field|null} prob - default probability applied to deals in this stage
 * @property {Field|null} order - column order on the kanban board
 * @property {Field|null} pipeline - single select; the board shows only stages of one pipeline
 * @property {Field|null} secondary - checkbox; checked stages form the "recurring" group the board's view slider can collapse
 * @property {Field|null} canWin - checkbox; deals can only be marked won/lost from stages where it is checked
 */

/** @typedef {Object} ResolvedFields
 * @property {DealFields} deal
 * @property {StageFields} stage
 * @property {EstimateFields} estimate
 * @property {StudioFields} studio
 * @property {OrganizationFields} organization
 * @property {ScenarioFields} scenario
 * @property {ServiceItemFields} serviceItem
 * @property {LicenseTermItemFields} licenseTermItem
 * @property {ServiceFields} service
 * @property {LicenseTermFields} licenseTerm
 * @property {NoteFields} notes
 * @property {NoteItemFields} noteItems
 * @property {NoteTemplateFields} noteTemplates
 */

export const SCHEMA = {
   tables: {
      deals: {
         key: 'deals',
         idKey: 'dealsTableId',
         aliases: ['deal', 'deals', 'negócios', 'negócio', 'negocios', 'negocio'],
      },

      estimates: {
         key: 'estimates',
         idKey: 'estimateTableId',
         aliases: [
            'estimates',
            'estimate',
            'estimation',
            'orçamentos',
            'orçamento',
            'orcamento',
            'orcamentos',
            'budget',
            'budgets',
         ],
      },

      stages: {
         key: 'stages',
         idKey: 'stageTableId',
         aliases: ['stages', 'stage', 'fases', 'fase', 'etapas', 'etapa'],
      },

      studios: {
         key: 'studios',
         idKey: 'studioTableId',
         aliases: ['studios', 'studio', 'estudio', 'estudios', 'estúdio', 'estudio'],
      },

      organizations: {
         key: 'organizations',
         idKey: 'organizationTableId',
         aliases: [
            'organizations',
            'organization',
            'organizações',
            'organização',
            'agencies',
            'agency',
            'agências',
            'agência',
            'agencias',
            'agencia',
         ],
      },

      scenarios: {
         key: 'scenarios',
         idKey: 'scenarioTableId',
         aliases: ['scenarios', 'scenario', 'cenário', 'cenários'],
      },

      config: {
         key: 'config',
         idKey: 'configTableId',
         aliases: ['config', 'configuration', 'configuração', 'settings'],
      },

      serviceItems: {
         key: 'serviceItems',
         idKey: 'itemTableId',
         aliases: [
            'scenario service items',
            'scenarioserviceitems',
            'scenario services',
            'scenarioservices',
            'servicos do cenário',
            'servicosdocenario',
            'serviços do cenario',
            'serviçosdocenário',
            'service items',
            'serviceitems',
            'items',
            'itens de serviço',
            'itens de servico',
            'itens de cenário',
            'item de cenário',
         ],
      },

      licenseTermItems: {
         key: 'licenseTermItems',
         idKey: 'licenseTermItemTableId',
         aliases: [
            'license term items',
            'licensetermitems',
            'license term item',
            'licensetermitem',
            'itens de termo de licença',
            'itens de termo de licenca',
            'item de termo de licença',
            'item de termo de licenca',
         ],
      },

      services: {
         key: 'services',
         idKey: 'serviceTableId',
         aliases: ['services', 'service', 'serviços', 'servico', 'serviço'],
      },

      licenseTerms: {
         key: 'licenseTerms',
         idKey: 'licenseTermTableId',
         aliases: [
            'license terms',
            'license term',
            'licenseterms',
            'licenseterm',
            'licenses',
            'license',
            'termos de licença',
            'termo de licença',
            'termos de licenca',
            'termo de licenca',
            'licenças',
            'licença',
            'licencas',
            'licenca',
         ],
      },

      notes: {
         key: 'notes',
         idKey: 'noteTableId',
         aliases: ['notes', 'note', 'notas', 'nota'],
      },

      noteItems: {
         key: 'noteItems',
         idKey: 'noteItemTableId',
         aliases: [
            'note items',
            'noteItems',
            'noteItem',
            'notesItem',
            'notesItems',
            'note item',
            'notas itens',
            'nota item',
            'notasitem',
            'notaitem',
         ],
      },

      noteTemplates: {
         key: 'noteTemplates',
         idKey: 'noteTemplateTableId',
         aliases: [
            'note templates',
            'noteTemplates',
            'noteTemplate',
            'notesTemplate',
            'notesTemplates',
            'note template',
            'notas modelos',
            'nota modelo',
            'notasmodelos',
            'notamodelo',
         ],
      },
   },

   /** @type {Object<string, Object<string, FieldDef>>} */
   fields: {
      stage: {
         prob: {
            aliases: ['probability', 'prob', 'probabilidade'],
            types: [FieldType.NUMBER, FieldType.PERCENT],
         },

         canWin: {
            aliases: ['can win', 'canwin', 'ganhar', 'ganhável', 'ganhavel'],
            types: [FieldType.CHECKBOX],
            required: true,
         },

         order: {
            aliases: ['order', 'ordem', 'position', 'posição', 'posicao'],
            types: [FieldType.NUMBER],
         },
         pipeline: {
            aliases: ['pipeline', 'funil'],
            types: [FieldType.SINGLE_SELECT],
         },
         secondary: {
            aliases: ['secondary', 'secundário', 'secundario', 'recorrente', 'recurring', 'collapsible', 'colapsável', 'colapsavel'],
            types: [FieldType.CHECKBOX],
         },
      },
      deal: {
         stage: {
            aliases: ['stage', 'fase', 'etapa'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },
         client: {
            aliases: ['client', 'cliente', 'end client', 'client final'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },
         agency: {
            aliases: ['agency', 'agência', 'agencia'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },
         contact: {
            aliases: ['contact', 'contato', 'contacto'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },
         owner: {
            aliases: ['owner', 'responsável', 'responsavel', 'dono'],
            types: [FieldType.SINGLE_COLLABORATOR],
            required: true,
         },
         prob: {
            aliases: ['prob', 'probability', 'probabilidade', '%'],
            types: [FieldType.PERCENT],
            required: true,
         },
         currencySymbol: {
            aliases: ['currency symbol', 'currency', 'moeda', 'símbolo'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA],
            required: true,
         },
         totalBudget: {
            aliases: ['budget', 'total budget', 'totalBudget', 'deal budget', 'orçamento', 'valor'],
            types: [FieldType.FORMULA, FieldType.CURRENCY, FieldType.NUMBER],
            required: true,
         },
         weightedBudget: {
            aliases: ['weighted budget', 'weighted', 'budget ponderado', 'valor ponderado'],
            types: [FieldType.FORMULA, FieldType.CURRENCY, FieldType.NUMBER],
            required: true,
         },
         position: {
            aliases: ['position', 'posição', 'posicao', 'ordem', 'order'],
            types: [FieldType.NUMBER],
            required: true,
         },
         status: {
            aliases: ['status', 'estado'],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
         lostReason: {
            aliases: ['lost reason', 'reason', 'motivo', 'razão', 'razao'],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
         lostReasonDetail: {
            aliases: ['lost reason detail', 'reason detail', 'detalhe do motivo', 'detalhes'],
            types: [FieldType.MULTILINE_TEXT, FieldType.SINGLE_LINE_TEXT],
            required: true,
         },
         estimate: {
            aliases: ['estimate', 'estimates', 'orçamento', 'orçamentos'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },
         estimatingTo: {
            aliases: ['estimating to', 'estimating', 'orçando para', 'destino do orçamento'],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
      },

      estimate: {
         deal: {
            aliases: ['deal', 'negócio', 'negocio'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },
         total: {
            aliases: ['total', 'estimate total'],
            types: [FieldType.FORMULA],
            required: true,
         },
         currencySymbol: {
            aliases: ['currency symbol', 'currency', 'moeda'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA],
            required: true,
         },
         date: {
            aliases: ['date', 'data', 'created', 'modified'],
            types: [FieldType.DATE, FieldType.CREATED_BY, FieldType.LAST_MODIFIED_TIME],
            required: true,
         },
         status: {
            aliases: ['status', 'estado'],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
         template: {
            aliases: ['template', 'modelo', 'tipo'],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
         templateId: {
            aliases: ['template id', 'templateid', 'id do template'],
            types: [FieldType.FORMULA],
            required: true,
         },
         scenarios: {
            aliases: ['scenarios', 'scenario', 'cenários', 'cenário'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },
         templateUrl: {
            aliases: ['template url', 'templateurl', 'url do template', 'template link'],
            types: [FieldType.URL],
            required: true,
         },
         projectName: {
            aliases: ['project name', 'project', 'nome do projeto', 'projeto'],
            types: [FieldType.MULTIPLE_LOOKUP_VALUES],
            required: true,
         },
         invoiceBy: {
            aliases: ['invoice by', 'invoiceby', 'faturar por', 'faturamento'],
            types: [FieldType.MULTIPLE_LOOKUP_VALUES],
            required: true,
         },

         noteItems: {
            aliases: ['note items', 'noteItems', 'notas', 'notas itens'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },
      },

      studio: {
         country: {
            aliases: ['country', 'país', 'pais'],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
         addressLine1: {
            aliases: ['address line 1', 'address 1', 'address', 'endereço', 'endereco', 'endereço 1'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.MULTILINE_TEXT, FieldType.URL],
            required: true,
         },
         addressLine2: {
            aliases: ['address line 2', 'address 2', 'endereço 2', 'endereco 2', 'city', 'cidade'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.MULTILINE_TEXT, FieldType.URL],
            required: true,
         },
         addressLine3: {
            aliases: ['address line 3', 'address 3', 'endereço 3', 'endereco 3', 'state', 'estado'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.MULTILINE_TEXT, FieldType.URL],
            required: true,
         },
         registration: {
            aliases: ['registration', 'registro', 'cnpj', 'ein', 'vat'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.MULTILINE_TEXT, FieldType.URL],
            required: true,
         },
         phone: {
            aliases: ['phone', 'telefone', 'tel'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.MULTILINE_TEXT, FieldType.URL],
            required: true,
         },
      },

      organization: {
         name: {
            aliases: ['name', 'nome', 'organization name', 'nome da organização'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA],
            required: true,
         },
         addressLine1: {
            aliases: ['address line 1', 'address 1', 'address', 'endereço', 'endereco'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA],
            required: true,
         },
         addressLine2: {
            aliases: ['address line 2', 'address 2', 'city', 'cidade'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA],
            required: true,
         },
         addressLine3: {
            aliases: ['address line 3', 'address 3', 'state', 'estado'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA],
            required: true,
         },
         taxId: {
            aliases: ['tax id', 'taxid', 'tax', 'cnpj', 'cpf', 'tax number'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA],
            required: true,
         },
         phone: {
            aliases: ['phone', 'telefone', 'tel'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA],
            required: true,
         },
         country: {
            aliases: ['country', 'país', 'pais'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.FORMULA],
            required: true,
         },
      },

      scenario: {
         name: { aliases: ['name', 'nome'], required: true, primary: true },
         total: { aliases: ['scenario total', 'total'], required: true },
         subTotal: {
            aliases: ['scenario sub total', 'subtotal', 'sub total', 'sub-total', 'scenario: subtotal'],
            required: true,
         },
         licenseTermItems: {
            aliases: [
               'licenseTermItems',
               'license term items',
               'license items',
               'license term',
               'license terms',
               'license',
               'licença',
               'licenças',
               'licenca',
               'licencas',
               'itens de termo de licença',
               'itens de termo de licenca',
               'itens de licença',
               'itens de licenca',
               'termos de licença',
               'termo de licença',
               'termo de licenca',
            ],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },
         items: {
            aliases: [
               'scenario service items',
               'scenarioserviceitems',
               'scenarioServices',
               'service items',
               'scenario services',
               'scenarioservice',
               'scenarioserviceitems',
               'serviços do cenário',
               'servicoscenário',
               'servicosdocenário',
               'servicos do cenario',
               'serviceitems',
               'items',
               'itens',
               'item',
            ],
            required: true,
         },
         discount: { aliases: ['discount', 'desconto'], required: true },
         isApproved: {
            aliases: ['is approved', 'approved', 'aprovado', 'aprovada', 'aprovados', 'aprovadas'],
            required: true,
         },
         order: {
            aliases: ['order', 'ordem', 'sequência', 'sequencia'],
            required: true,
         },
         description: {
            aliases: ['description', 'descrição', 'descricao'],
            required: true,
         },
         showDescription: {
            aliases: [
               'show description',
               'showdescription',
               'mostrar descrição',
               'mostrar descricao',
               'exibir descrição',
               'exibir descricao',
            ],
            required: true,
         },
      },

      serviceItem: {
         name: { aliases: ['name', 'nome'], required: false, primary: true },
         description: {
            aliases: ['description', 'descrição', 'descricao'],
            required: true,
         },
         position: {
            aliases: ['position', 'posição', 'posicao', 'ordem', 'order'],
            types: [FieldType.NUMBER],
            required: true,
         },
         quantity: { aliases: ['quantity', 'quantidade'], required: true },
         unitPrice: {
            aliases: [
               'unit price',
               'unit cost',
               'unitcost',
               'valorreferência',
               'value',
               'valor',
               'unitprice',
               'preço unitário',
               'preco unitario',
            ],
            required: true,
         },
         discount: { aliases: ['discount', 'desconto'], required: true },
         calculatedDiscount: {
            aliases: [
               'discount calc',
               'calculated discount',
               'calculatedDiscount',
               'desconto calculado',
               'desconto calc',
               'Desconto Calc',
            ],
            required: true,
         },
         referenceValue: {
            aliases: [
               'reference value',
               'service: reference value',
               'serviço: valor de referência',
               'valor de referência',
               'valor referencia',
            ],
            required: true,
         },

         referenceDescription: {
            aliases: [
               'reference description',
               'ref description',
               'service: reference description',
               'serviço: descrição de referência',
               'serviço: descrição referência',
               'service: descrição deferência',
               'service: descrição de deferência',
               'descrição referência',
               'descricao referencia',
               'descrição de referência',
               'descricao de referencia',
            ],
            required: true,
         },
         currencySymbol: {
            aliases: ['currency symbol', 'scenario: currency symbol'],
            required: true,
         },
         currency: {
            aliases: ['currency', 'scenario: currency', 'moeda'],
            required: true,
         },
         serviceId: {
            aliases: ['service', 'services', 'serviços', 'servicos', 'serviço', 'servico'],
            required: true,
         },
         // lookup of the linked service's `type`, so the category color needs no Services query.
         // Not required: a base without it simply renders no category color.
         serviceType: {
            aliases: [
               'service type',
               'servicetype',
               'service: type',
               'serviço tipo',
               'servico tipo',
               'serviço: tipo',
               'tipo de serviço',
            ],
            types: [FieldType.MULTIPLE_LOOKUP_VALUES],
            required: false,
         },
         total: { aliases: ['formatted total'], required: true },
      },

      // The license counterpart of serviceItem. No reference lookups here: the term's own
      // values come from the linked License Terms record (see useLicenseTermItems.js). Writable
      // fields list their schema key first (matching is case-insensitive), and override aliases end
      // with the bare noun so a base that names the field just "Media" still resolves.
      licenseTermItem: {
         name: { aliases: ['name', 'nome'], required: false, primary: true },
         quantity: { aliases: ['quantity', 'quantidade'], required: true },
         unitPrice: {
            aliases: [
               'unitPrice',
               'unit price',
               'unit cost',
               'unitcost',
               'value',
               'valor',
               'preço unitário',
               'preco unitario',
            ],
            required: true,
         },
         position: {
            aliases: ['position', 'posição', 'posicao', 'ordem', 'order'],
            types: [FieldType.NUMBER],
            required: true,
         },

         discount: { aliases: ['discount', 'desconto'], required: true },
         // The two formula fields are display-only, so a base that lacks them still renders the row.
         calculatedDiscount: {
            aliases: [
               'calculatedDiscount',
               'calculated discount',
               'discount calc',
               'desconto calculado',
               'desconto calc',
            ],
            required: false,
         },
         currencySymbol: {
            aliases: ['currencySymbol', 'LicenseTerm: Currency Symbol', 'currency symbol', 'scenario: currency symbol'],
            required: true,
         },
         currency: {
            aliases: ['currency', 'scenario: currency', 'moeda'],
            required: true,
         },
         total: { aliases: ['Formatted Total', 'formatted total', 'formattedTotal'], required: true },
         licenseTermId: {
            aliases: [
               'licenseTermId',
               'licenseTerm',
               'license term',
               'license terms',
               'license',
               'licença',
               'licenca',
               'termo de licença',
               'termo de licenca',
            ],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },

         mediaOverride: {
            aliases: [
               'mediaOverride',
               'media override',
               'override media',
               'mídia editável',
               'midia editavel',
               'media',
               'mídia',
               'midia',
            ],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.MULTILINE_TEXT],
            required: true,
         },
         durationOverride: {
            aliases: [
               'durationOverride',
               'duration override',
               'override duration',
               'duração editável',
               'duracao editavel',
               'duration',
               'duração',
               'duracao',
            ],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.MULTILINE_TEXT],
            required: true,
         },
         exclusivityOverride: {
            aliases: [
               'exclusivityOverride',
               'exclusivity override',
               'override exclusivity',
               'exclusividade editável',
               'exclusividade editavel',
               'exclusivity',
               'exclusividade',
            ],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
         scopeOverride: {
            aliases: [
               'scopeOverride',
               'scope override',
               'override scope',
               'escopo editável',
               'escopo editavel',
               'scope',
               'escopo',
            ],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
         territoryOverride: {
            aliases: [
               'territoryOverride',
               'territory override',
               'override territory',
               'território editável',
               'territorio editavel',
               'territory',
               'território',
               'territorio',
            ],
            types: [FieldType.MULTIPLE_SELECTS],
            required: true,
         },
      },

      service: {
         name: { aliases: ['name', 'nome'], required: true, primary: true },
         description: {
            aliases: ['description', 'descrição', 'descricao'],
            required: true,
         },
         value: {
            aliases: [
               'value',
               'valor',
               'formated value',
               'service value',
               'valor do serviço',
               'formatted value',
               'formattedvalue',
               'valor formatado',
               'valorformatado',
            ],
            required: true,
         },
         currency: {
            aliases: ['currency', 'moeda'],
            required: true,
         },
         type: {
            aliases: ['type', 'category', 'service type', 'tipo', 'tipo de serviço', 'tipo de servico'],
            required: true,
         },
      },
      licenseTerm: {
         name: {
            aliases: ['name', 'nome', 'license term', 'termo de licença', 'termo de licenca'],
            required: false,
            primary: true,
         },
         type: {
            aliases: [
               'type',
               'tipo',
               'types',
               'tipos',
               'license term type',
               'tipo de licença',
               'tipo de licenca',
               'tipo de licença',
            ],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },

         exclusivity: {
            aliases: ['exclusivity', 'exclusividade'],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
         scope: {
            aliases: ['scope', 'escopo'],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
         duration: {
            aliases: ['duration', 'duração', 'duracao', 'prazo', 'term', 'termo'],
            types: [FieldType.SINGLE_LINE_TEXT, FieldType.MULTILINE_TEXT],
            required: true,
         },
         media: {
            aliases: ['media', 'mídia', 'midia', 'mídias', 'midias'],
            types: [FieldType.MULTILINE_TEXT, FieldType.RICH_TEXT, FieldType.SINGLE_LINE_TEXT],
            required: true,
         },
         territory: {
            aliases: ['territory', 'territories', 'território', 'territorio', 'territórios', 'territorios'],
            types: [FieldType.MULTIPLE_SELECTS],
            required: true,
         },
         currency: {
            aliases: ['currency', 'moeda'],
            types: [FieldType.SINGLE_SELECT],
            required: true,
         },
         currencySymbol: {
            aliases: ['currency symbol', 'símbolo da moeda', 'simbolo da moeda', 'símbolo', 'simbolo'],
            types: [FieldType.FORMULA],
            required: true,
         },
         referenceValue: {
            aliases: [
               'reference value',
               'valor de referência',
               'valor de referencia',
               'valor referencia',
               'value',
               'valor',
            ],
            types: [FieldType.NUMBER, FieldType.CURRENCY],
            required: true,
         },
         formattedValue: {
            aliases: ['formatted value', 'formated value', 'valor formatado', 'valorformatado'],
            types: [FieldType.FORMULA],
            required: true,
         },
      },

      notes: {
         name: { aliases: ['name', 'nome'], required: true, primary: true },
         description: {
            aliases: ['description', 'descrição', 'descricao'],
            types: [FieldType.RICH_TEXT],
            required: true,
         },
         category: {
            aliases: ['category', 'categoria'],
            required: true,
            types: [FieldType.SINGLE_SELECT],
         },

         createdBy: {
            aliases: ['created by', 'criado por', 'criado', 'createdBy', 'criadoPor'],
            types: [FieldType.CREATED_BY],
            required: true,
         },
      },

      noteItems: {
         name: { aliases: ['name', 'nome'], required: true, primary: true },
         description: {
            aliases: [
               'descriptionOverride',
               'description override',
               'description',
               'descrição',
               'descricao',
               'descrição override',
               'descricao override',
            ],
            types: [FieldType.RICH_TEXT],
            required: true,
         },

         noteId: {
            aliases: ['note', 'notes', 'notas', 'noteId', 'nota', 'notaId', 'notas', 'notasId'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },

         estimateId: {
            aliases: ['estimate', 'estimates', 'orçamento', 'orcamento', 'estimateId', 'orçamentoId', 'orcamentoId'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },

         position: {
            aliases: ['position', 'posição', 'posicao', 'ordem', 'order'],
            types: [FieldType.NUMBER],
            required: true,
         },
      },

      noteTemplates: {
         name: { aliases: ['name', 'nome'], required: true, primary: true },
         noteIds: {
            aliases: ['notes', 'notas', 'noteIds', 'notaIds', 'notasIds'],
            types: [FieldType.MULTIPLE_RECORD_LINKS],
            required: true,
         },
      },
   },

   /** Maps field groups → table keys */
   groupToTable: {
      deal: 'deals',
      stage: 'stages',
      estimate: 'estimates',
      studio: 'studios',
      organization: 'organizations',
      scenario: 'scenarios',
      serviceItem: 'serviceItems',
      service: 'services',
      licenseTermItem: 'licenseTermItems',
      licenseTerm: 'licenseTerms',
      notes: 'notes',
      noteItems: 'noteItems',
      noteTemplates: 'noteTemplates',
   },
}
