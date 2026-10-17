import * as React from "react"
import Query from "../airtable/queries.js"
import {Table} from "@airtable/blocks/interface/models"
import {useRecords} from "@airtable/blocks/interface/ui";


/**
 * @param {Table} table
 * @param {(query: Query) => Query} queryBuilder
 * @returns {import("../airtable/queries.js").ApplyResult}
 */
export function useQuery(table, queryBuilder) {
   const records = useRecords(table);
   return React.useMemo(() => {
      const q = queryBuilder(new Query(table));
      return q.apply(records);
   }, [records, queryBuilder, table])
}

