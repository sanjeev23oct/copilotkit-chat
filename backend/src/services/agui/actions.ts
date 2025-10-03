import { AGUIAction, AGUIActionResult, AGUIElement } from '../../types/agui';
import { databaseService } from '../database';
import logger from '../../utils/logger';

export class AGUIActionRegistry {
  private actions: Map<string, AGUIAction> = new Map();

  constructor() {
    this.registerDefaultActions();
  }

  registerAction(action: AGUIAction): void {
    this.actions.set(action.id, action);
    logger.info(`Registered AGUI action: ${action.id}`);
  }

  async executeAction(actionId: string, parameters: Record<string, any>): Promise<AGUIActionResult> {
    const action = this.actions.get(actionId);
    if (!action) {
      return {
        success: false,
        error: `Action '${actionId}' not found`
      };
    }

    try {
      logger.info(`Executing AGUI action: ${actionId}`, parameters);
      const result = await action.handler(parameters);
      logger.info(`Action '${actionId}' completed successfully`);
      return result;
    } catch (error) {
      logger.error(`Action '${actionId}' failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Action execution failed'
      };
    }
  }

  getActions(): AGUIAction[] {
    return Array.from(this.actions.values());
  }

  private registerDefaultActions(): void {
    // Database query action
    this.registerAction({
      id: 'query_database',
      name: 'Query Database',
      description: 'Execute a database query and return results in a table',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'SQL query to execute',
          required: true
        }
      ],
      handler: async (params) => {
        try {
          const { query } = params;
          const result = await databaseService.executeQuery(query);

          if (result.rows.length === 0) {
            return {
              success: true,
              message: 'Query executed successfully but returned no results',
              data: result.rows
            };
          }

          // Create AGUI table
          const headers = Object.keys(result.rows[0]);
          const rows = result.rows.map(row => headers.map(header => row[header]));

          const tableElement: AGUIElement = {
            type: 'table',
            id: `table_${Date.now()}`,
            props: {
              headers,
              rows,
              sortable: true,
              filterable: true,
              pagination: result.rows.length > 10 ? {
                page: 1,
                pageSize: 10,
                total: result.rows.length
              } : undefined
            }
          };

          return {
            success: true,
            data: result.rows,
            message: `Query returned ${result.rowCount} row(s)`,
            agui: [tableElement]
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Database query failed'
          };
        }
      }
    });

    // Get table schema action
    this.registerAction({
      id: 'get_table_schema',
      name: 'Get Table Schema',
      description: 'Get database table schema information',
      parameters: [],
      handler: async () => {
        try {
          const schema = await databaseService.getTableSchema();

          // Group by table name
          const tables = new Map<string, any[]>();
          schema.forEach(row => {
            if (!tables.has(row.table_name)) {
              tables.set(row.table_name, []);
            }
            if (row.column_name) {
              tables.get(row.table_name)?.push({
                column: row.column_name,
                type: row.data_type,
                nullable: row.is_nullable === 'YES' ? 'Yes' : 'No',
                default: row.column_default || 'None'
              });
            }
          });

          // Create AGUI cards for each table
          const cardElements: AGUIElement[] = Array.from(tables.entries()).map(([tableName, columns]) => ({
            type: 'card',
            id: `schema_${tableName}`,
            props: {
              title: tableName,
              subtitle: `${columns.length} columns`,
              content: `Table: ${tableName}`,
              actions: [
                {
                  type: 'button',
                  id: `sample_${tableName}`,
                  props: {
                    text: 'View Sample Data',
                    variant: 'primary',
                    onClick: 'get_sample_data'
                  }
                }
              ]
            },
            children: [
              {
                type: 'table',
                id: `columns_${tableName}`,
                props: {
                  headers: ['Column', 'Type', 'Nullable', 'Default'],
                  rows: columns.map(col => [col.column, col.type, col.nullable, col.default])
                }
              }
            ]
          }));

          return {
            success: true,
            data: Array.from(tables.entries()).map(([tableName, columns]) => ({ tableName, columns })),
            message: `Found ${tables.size} table(s) in the database`,
            agui: cardElements
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch table schema'
          };
        }
      }
    });

    // Get sample data action
    this.registerAction({
      id: 'get_sample_data',
      name: 'Get Sample Data',
      description: 'Get sample data from a table',
      parameters: [
        {
          name: 'tableName',
          type: 'string',
          description: 'Name of the table',
          required: true
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Number of rows to return',
          default: 5
        }
      ],
      handler: async (params) => {
        try {
          const { tableName, limit = 5 } = params;
          const sampleData = await databaseService.getSampleData(tableName, limit);

          if (sampleData.length === 0) {
            return {
              success: true,
              message: `Table '${tableName}' is empty`,
              data: []
            };
          }

          // Create AGUI table
          const headers = Object.keys(sampleData[0]);
          const rows = sampleData.map(row => headers.map(header => row[header]));

          const tableElement: AGUIElement = {
            type: 'table',
            id: `sample_${tableName}_${Date.now()}`,
            props: {
              headers,
              rows,
              sortable: true
            }
          };

          return {
            success: true,
            data: sampleData,
            message: `Sample data from '${tableName}' (${sampleData.length} rows)`,
            agui: [tableElement]
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch sample data'
          };
        }
      }
    });

    // Create visualization action
    this.registerAction({
      id: 'create_chart',
      name: 'Create Chart',
      description: 'Create a chart from data',
      parameters: [
        {
          name: 'data',
          type: 'array',
          description: 'Data to visualize',
          required: true
        },
        {
          name: 'chartType',
          type: 'string',
          description: 'Type of chart (bar, line, pie, doughnut)',
          default: 'bar'
        },
        {
          name: 'xField',
          type: 'string',
          description: 'Field to use for X-axis',
          required: true
        },
        {
          name: 'yField',
          type: 'string',
          description: 'Field to use for Y-axis',
          required: true
        }
      ],
      handler: async (params) => {
        try {
          const { data, chartType = 'bar', xField, yField } = params;

          if (!Array.isArray(data) || data.length === 0) {
            return {
              success: false,
              error: 'Data must be a non-empty array'
            };
          }

          const labels = data.map(item => item[xField]);
          const values = data.map(item => item[yField]);

          const chartElement: AGUIElement = {
            type: 'chart',
            id: `chart_${Date.now()}`,
            props: {
              chartType,
              data: {
                labels,
                datasets: [{
                  label: yField,
                  data: values,
                  backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
                  ]
                }]
              }
            }
          };

          return {
            success: true,
            data: { labels, values },
            message: `Created ${chartType} chart with ${data.length} data points`,
            agui: [chartElement]
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create chart'
          };
        }
      }
    });

    // Pull data from PostgreSQL with natural language
    this.registerAction({
      id: 'pull_postgres_data',
      name: 'Pull PostgreSQL Data',
      description: 'Pull data from PostgreSQL database using SQL query or table name',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'SQL SELECT query to execute (optional if tableName is provided)',
          required: false
        },
        {
          name: 'tableName',
          type: 'string',
          description: 'Name of the table to query (optional if query is provided)',
          required: false
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of rows to return',
          default: 100
        },
        {
          name: 'visualize',
          type: 'boolean',
          description: 'Whether to create a visualization of the data',
          default: false
        }
      ],
      handler: async (params) => {
        try {
          const { query, tableName, limit = 100, visualize = false } = params;

          if (!query && !tableName) {
            return {
              success: false,
              error: 'Either query or tableName must be provided'
            };
          }

          let sqlQuery = query;
          
          // If tableName is provided, construct a simple SELECT query
          if (!sqlQuery && tableName) {
            const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
            sqlQuery = `SELECT * FROM ${sanitizedTableName} LIMIT ${limit}`;
          }

          // Execute the query
          const result = await databaseService.executeQuery(sqlQuery);

          if (result.rows.length === 0) {
            return {
              success: true,
              message: 'Query executed successfully but returned no results',
              data: []
            };
          }

          // Create AGUI table
          const headers = Object.keys(result.rows[0]);
          const rows = result.rows.map(row => headers.map(header => {
            const value = row[header];
            // Format dates and complex objects
            if (value instanceof Date) {
              return value.toISOString();
            } else if (typeof value === 'object' && value !== null) {
              return JSON.stringify(value);
            }
            return value;
          }));

          const tableElement: AGUIElement = {
            type: 'table',
            id: `postgres_table_${Date.now()}`,
            props: {
              headers,
              rows,
              sortable: true,
              filterable: true,
              pagination: result.rows.length > 10 ? {
                page: 1,
                pageSize: 10,
                total: result.rows.length
              } : undefined
            }
          };

          const aguiElements: AGUIElement[] = [tableElement];

          // Add visualization if requested and data is suitable
          if (visualize && result.rows.length > 0) {
            // Try to find numeric columns for visualization
            const numericColumns = headers.filter(header => {
              const firstValue = result.rows[0][header];
              return typeof firstValue === 'number' || !isNaN(Number(firstValue));
            });

            if (numericColumns.length > 0 && headers.length > 1) {
              const labelColumn = headers[0];
              const valueColumn = numericColumns[0];
              
              const labels = result.rows.slice(0, 10).map(row => String(row[labelColumn]));
              const values = result.rows.slice(0, 10).map(row => Number(row[valueColumn]));

              const chartElement: AGUIElement = {
                type: 'chart',
                id: `postgres_chart_${Date.now()}`,
                props: {
                  chartType: 'bar',
                  data: {
                    labels,
                    datasets: [{
                      label: valueColumn,
                      data: values,
                      backgroundColor: '#36A2EB'
                    }]
                  }
                }
              };

              aguiElements.push(chartElement);
            }
          }

          return {
            success: true,
            data: result.rows,
            message: `Retrieved ${result.rowCount} row(s) from PostgreSQL`,
            agui: aguiElements
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to pull data from PostgreSQL'
          };
        }
      }
    });

    // List all available tables
    this.registerAction({
      id: 'list_postgres_tables',
      name: 'List PostgreSQL Tables',
      description: 'List all available tables in the PostgreSQL database',
      parameters: [],
      handler: async () => {
        try {
          const schema = await databaseService.getTableSchema();

          // Get unique table names
          const tableNames = [...new Set(schema.map(row => row.table_name))];

          if (tableNames.length === 0) {
            return {
              success: true,
              message: 'No tables found in the database',
              data: []
            };
          }

          // Create a card for each table
          const cardElements: AGUIElement[] = tableNames.map(tableName => {
            const tableColumns = schema.filter(row => row.table_name === tableName && row.column_name);
            
            return {
              type: 'card',
              id: `table_card_${tableName}`,
              props: {
                title: tableName,
                subtitle: `${tableColumns.length} columns`,
                content: `Table: ${tableName}\nColumns: ${tableColumns.map(c => c.column_name).join(', ')}`
              }
            };
          });

          return {
            success: true,
            data: tableNames,
            message: `Found ${tableNames.length} table(s) in PostgreSQL database`,
            agui: cardElements
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list PostgreSQL tables'
          };
        }
      }
    });
  }
}

export const aguiActionRegistry = new AGUIActionRegistry();