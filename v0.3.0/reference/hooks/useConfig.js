import { getCustomProperties, getCustomPropertiesTables } from '../config/customProperties.js'
import { useCustomProperties, useBase } from '@airtable/blocks/interface/ui'
import { resolveConfig } from '../config/configResolver.js'
import { colorUtils } from "@airtable/blocks/interface/ui";
import { useConfigTable } from './useConfigTable.js'
import * as React from 'react'

/** @typedef {import("../config/configResolver.js").ResolvedConfig} ResolvedConfig
 * @typedef {import("../config/ValidationResult.js").ValidationResult} ValidationResult
 */

export function useCustoProps() {
   /** @returns {Record<string, any>} */
   const getConfig = React.useCallback(getCustomProperties, [])
   const { customPropertyValueByKey: custoProps } = useCustomProperties(getConfig)
   return custoProps
}

/**
 * Single source of truth for config:
 * - config.tables (typed)
 * - config.fields (typed, all groups)
 * - config.fields.scenario (scenario fields)
 * - validation (all issues)
 *
 * @returns {{ config: ResolvedConfig, validation: ValidationResult }}
 */
export function useConfig() {
   const base = useBase()
   const custoProps = useCustoProps()

   const tables = React.useMemo(() => getCustomPropertiesTables(base, custoProps), [base, custoProps])
   const configOverrides = useConfigTable(tables.config || null)

   return React.useMemo(() => {
      return resolveConfig(base, custoProps, configOverrides)
   }, [base, custoProps, configOverrides])
}

export function useBaseColor() {
   const base = useBase()
   return colorUtils.getHexForColor(base.color);
}
