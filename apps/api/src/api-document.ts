import { z } from 'zod';
import { apiContracts, errorSchema, idSchema } from '@financial-tracking/contracts';
import type { OpenAPIObject, SchemaObject, ParameterObject } from '@nestjs/swagger';

/** Generate documentation from the same Zod fields used at runtime and in the browser. */
export function completeApiDocument(document: OpenAPIObject) {
  document.openapi = '3.1.0';
  for (const [operationId, contract] of Object.entries(apiContracts)) {
    const path = `/api/v1${contract.path}`;
    if (!document.paths[path]?.[contract.method]) throw new Error(`Missing implementation for ${operationId}`);
    /** Remove the JSON Schema dialect marker before embedding a schema in OpenAPI. */
    const schema = (value: z.ZodType): SchemaObject => {
      const converted = z.toJSONSchema(value);
      const { $schema: _dialect, ...rest } = converted;
      void _dialect;
      return rest as SchemaObject;
    };
    const parameters: ParameterObject[] = [];
    for (const match of contract.path.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g))
      parameters.push({ name: match[1]!, in: 'path', required: true, schema: schema(idSchema) });
    if (contract.query) {
      const query = z.toJSONSchema(contract.query);
      for (const [name, property] of Object.entries(query.properties ?? {}))
        parameters.push({
          name,
          in: 'query',
          required: query.required?.includes(name) ?? false,
          schema: property as SchemaObject,
        });
    }
    if (!contract.public && contract.method !== 'get')
      parameters.push({ name: 'X-CSRF-Token', in: 'header', required: true, schema: { type: 'string' } });
    const responses: Record<
      string,
      { description: string; content: { 'application/json': { schema: SchemaObject } } }
    > = {};
    responses[String(contract.status)] = {
      description: 'Success',
      content: { 'application/json': { schema: schema(contract.response) } },
    };
    for (const status of [400, 401, 403, 404, 409, 413, 422, 429, 500, 502, 503])
      responses[String(status)] = {
        description: 'Safe application error',
        content: { 'application/json': { schema: schema(errorSchema) } },
      };
    document.paths[path]![contract.method] = {
      operationId,
      parameters,
      responses,
      security: contract.public ? [] : [{ cookie: [] }],
      ...(contract.request
        ? { requestBody: { required: true, content: { 'application/json': { schema: schema(contract.request) } } } }
        : {}),
    };
  }
  return document;
}
