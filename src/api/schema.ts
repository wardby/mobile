// Generated from openapi.yml. Regenerate with npm run api:generate. Do not edit.
export interface paths {
  '/admin/api/graph': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Graph snapshot
     * @description Agents, runs, coding-run services and outcomes for a time window, as a graph.
     *
     *     Requires a bearer token with the `admin:view` scope, held by a caller with the admin role.
     */
    get: operations['getGraph'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/admin/api/runs/{id}': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Run detail
     * @description Full detail for one run, including final text.
     *
     *     Requires a bearer token with the `admin:view` scope, held by a caller with the admin role.
     */
    get: operations['getRun'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/admin/api/infra': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Infrastructure info
     * @description Where and how this wardby deployment runs its workloads.
     *
     *     Requires a bearer token with the `admin:view` scope, held by a caller with the admin role.
     */
    get: operations['getInfra'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/admin/api/events': {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    /**
     * Live event stream
     * @description A Server-Sent Events stream (`text/event-stream`) of live changes. Frames:
     *
     *     - `retry: 3000`: suggested client reconnect delay in milliseconds.
     *     - `event: hello`: sent first. Data is `{"connected": <bool>}`, whether the server's live-event connection is up.
     *     - `event: run`, `event: service`, `event: outcome`: a run, coding-run service, or outcome changed. Each carries an `id:` line. Payloads match the `viewer-event` schema (see `x-event-schema`).
     *     - `event: status`: the server's live-event connection changed. Data is `{"connected": <bool>}`.
     *     - `event: resync`: the live-event connection is up (again). Events may have been missed: refetch the graph.
     *     - `: ping`: comment sent every 15 seconds to keep the connection open.
     *
     *     There is no replay. Open the event stream first, then load `/admin/api/graph` and apply events on top of it. Refetch the graph on every `resync` and after every reconnect rather than trying to resume.
     *
     *     Requires a bearer token with the `admin:view` scope, held by a caller with the admin role.
     */
    get: operations['getEvents'];
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    'graph-snapshot': {
      generatedAt: string;
      since: string;
      limit: number;
      truncated: boolean;
      runs: {
        id: string;
        parentRunId: string | null;
        agentId: string;
        agentName: string;
        /** @enum {string} */
        agentKind: 'native' | 'coding';
        model: string;
        codingProvider: string | null;
        nativeExecutionMode: ('control-plane' | 'sandbox') | null;
        warmWorkerName: string | null;
        /** @enum {string} */
        status:
          | 'pending'
          | 'running'
          | 'succeeded'
          | 'failed'
          | 'refused'
          | 'lost'
          | 'budget_exhausted'
          | 'cancelled';
        trigger:
          | {
              /** @constant */
              kind: 'manual';
            }
          | {
              /** @constant */
              kind: 'scheduled';
              schedule: string | null;
            }
          | {
              /** @constant */
              kind: 'webhook';
            }
          | {
              /** @constant */
              kind: 'subagent';
            }
          | {
              /** @constant */
              kind: 'code_host';
              provider: string;
              repository: string;
              number: number | null;
              /** @enum {string} */
              event: 'review' | 'mention';
            }
          | {
              /** @constant */
              kind: 'issue';
              provider: string;
              issueKey: string;
              url: string | null;
            }
          | {
              /** @constant */
              kind: 'host_event';
            };
        turns: number;
        tokensIn: number;
        tokensOut: number;
        costUsd: number;
        budgetUsd: number;
        startedAt: string;
        finishedAt: string | null;
        heartbeatAt: string | null;
        outcomes: (
          | {
              /** @constant */
              kind: 'pull_request';
              provider: string;
              repository: string;
              number: number;
              url: string;
              state: string | null;
              at: string | null;
            }
          | {
              /** @constant */
              kind: 'code_host_comment';
              provider: string;
              repository: string;
              number: number;
              at: string | null;
            }
          | {
              /** @constant */
              kind: 'issue_comment';
              provider: string;
              issueKey: string;
              url: string | null;
              at: string | null;
            }
          | {
              /** @constant */
              kind: 'check';
              provider: string;
              repository: string;
              number: number | null;
              completed: boolean;
              at: string | null;
            }
        )[];
        declaredServices: {
          name: string;
          version: string;
        }[];
        services: {
          name: string;
          /** @enum {string} */
          state: 'pending' | 'probing' | 'ready' | 'failed';
          attempts: number | null;
          reason: string | null;
          readyAt: string | null;
          failedAt: string | null;
          createdAt: string;
        }[];
      }[];
      spend: {
        todayUsd: number;
        groups: {
          id: string;
          name: string;
          dailyBudgetUsd: number | null;
          spentTodayUsd: number;
        }[];
      };
    };
    'run-detail': {
      id: string;
      parentRunId: string | null;
      agentId: string;
      agentName: string;
      /** @enum {string} */
      agentKind: 'native' | 'coding';
      model: string;
      codingProvider: string | null;
      nativeExecutionMode: ('control-plane' | 'sandbox') | null;
      warmWorkerName: string | null;
      /** @enum {string} */
      status:
        | 'pending'
        | 'running'
        | 'succeeded'
        | 'failed'
        | 'refused'
        | 'lost'
        | 'budget_exhausted'
        | 'cancelled';
      trigger:
        | {
            /** @constant */
            kind: 'manual';
          }
        | {
            /** @constant */
            kind: 'scheduled';
            schedule: string | null;
          }
        | {
            /** @constant */
            kind: 'webhook';
          }
        | {
            /** @constant */
            kind: 'subagent';
          }
        | {
            /** @constant */
            kind: 'code_host';
            provider: string;
            repository: string;
            number: number | null;
            /** @enum {string} */
            event: 'review' | 'mention';
          }
        | {
            /** @constant */
            kind: 'issue';
            provider: string;
            issueKey: string;
            url: string | null;
          }
        | {
            /** @constant */
            kind: 'host_event';
          };
      turns: number;
      tokensIn: number;
      tokensOut: number;
      costUsd: number;
      budgetUsd: number;
      startedAt: string;
      finishedAt: string | null;
      heartbeatAt: string | null;
      outcomes: (
        | {
            /** @constant */
            kind: 'pull_request';
            provider: string;
            repository: string;
            number: number;
            url: string;
            state: string | null;
            at: string | null;
          }
        | {
            /** @constant */
            kind: 'code_host_comment';
            provider: string;
            repository: string;
            number: number;
            at: string | null;
          }
        | {
            /** @constant */
            kind: 'issue_comment';
            provider: string;
            issueKey: string;
            url: string | null;
            at: string | null;
          }
        | {
            /** @constant */
            kind: 'check';
            provider: string;
            repository: string;
            number: number | null;
            completed: boolean;
            at: string | null;
          }
      )[];
      declaredServices: {
        name: string;
        version: string;
      }[];
      services: {
        name: string;
        /** @enum {string} */
        state: 'pending' | 'probing' | 'ready' | 'failed';
        attempts: number | null;
        reason: string | null;
        readyAt: string | null;
        failedAt: string | null;
        createdAt: string;
      }[];
      error: string | null;
      finalText: string | null;
      childRunIds: string[];
      coding: {
        provider: string;
        repository: string;
        baseRef: string;
        headRef: string;
        queuedAt: string | null;
        failureCategory: string | null;
        services: {
          name: string;
          version: string;
          image: string;
          envNames: string[];
        }[];
      } | null;
    };
    'viewer-event':
      | {
          /** @constant */
          kind: 'run';
          runId: string;
          parentRunId: string | null;
          agentId: string;
          /** @enum {string} */
          status:
            | 'pending'
            | 'running'
            | 'succeeded'
            | 'failed'
            | 'refused'
            | 'lost'
            | 'budget_exhausted'
            | 'cancelled';
          turns: number;
          tokensIn: number;
          tokensOut: number;
          costUsd: number;
          finishedAt: string | null;
        }
      | {
          /** @constant */
          kind: 'service';
          runId: string;
          name: string;
          /** @enum {string} */
          state: 'pending' | 'probing' | 'ready' | 'failed';
          attempts: number | null;
        }
      | {
          /** @constant */
          kind: 'outcome';
          runId: string;
          /** @enum {string} */
          source: 'pull_request' | 'host_status' | 'issue_status' | 'host_check';
        };
    'infra-info': {
      /** @enum {string} */
      launcher: 'local' | 'docker' | 'kubernetes';
      kubernetes: {
        namespace: string;
        platform: string;
        runtimeClass: string | null;
        proxyService: string;
        runLabel: string;
        runLabelHashChars: number;
        componentLabel: {
          [key: string]: string;
        };
        managedByLabel: {
          [key: string]: string;
        };
      } | null;
      native: {
        /** @enum {string} */
        launcher: 'docker' | 'kubernetes';
        warmPoolSize: number;
        kubernetes: {
          namespace: string;
          runtimeClass: string | null;
          runLabel: string;
          componentLabel: {
            [key: string]: string;
          };
          warmPoolLabel: {
            [key: string]: string;
          };
          warmWorkerLabel: string;
        } | null;
      } | null;
    };
    ViewerError: {
      error: string;
    };
    ViewerInternalError: {
      /** @enum {string} */
      error: 'internal_error';
      id: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: {
    /** @description Bearer challenge. */
    WWWAuthenticate: string;
  };
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  getGraph: {
    parameters: {
      query?: {
        /** @description Window start: `15m`, `1h`, `6h`, `24h`, `7d`, or an ISO-8601 timestamp. Default `1h`. */
        since?: string;
        /** @description Maximum number of runs, 1 to 2000. Default 500. */
        limit?: number;
      };
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description The graph snapshot. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['graph-snapshot'];
        };
      };
      /** @description A query parameter is invalid. */
      400: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'invalid_since' | 'invalid_limit';
          };
        };
      };
      /** @description No valid bearer token. */
      401: {
        headers: {
          'WWW-Authenticate': components['headers']['WWWAuthenticate'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'invalid_token';
          };
        };
      };
      /** @description Token lacks the `admin:view` scope (the `WWW-Authenticate` header is present), or the caller lacks the admin role (no `WWW-Authenticate` header). */
      403: {
        headers: {
          'WWW-Authenticate': components['headers']['WWWAuthenticate'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'invalid_token';
          };
        };
      };
      /** @description Only GET is allowed. */
      405: {
        headers: {
          /** @description Allowed methods: GET. */
          Allow?: 'GET';
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'method_not_allowed';
          };
        };
      };
      /** @description Unexpected server error (HTTP 500). `id` identifies the failure in the server log. */
      default: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerInternalError'];
        };
      };
    };
  };
  getRun: {
    parameters: {
      query?: never;
      header?: never;
      path: {
        /** @description Run id. */
        id: string;
      };
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description The run. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['run-detail'];
        };
      };
      /** @description No valid bearer token. */
      401: {
        headers: {
          'WWW-Authenticate': components['headers']['WWWAuthenticate'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'invalid_token';
          };
        };
      };
      /** @description Token lacks the `admin:view` scope (the `WWW-Authenticate` header is present), or the caller lacks the admin role (no `WWW-Authenticate` header). */
      403: {
        headers: {
          'WWW-Authenticate': components['headers']['WWWAuthenticate'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'invalid_token';
          };
        };
      };
      /** @description No run with that id. */
      404: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'not_found';
          };
        };
      };
      /** @description Only GET is allowed. */
      405: {
        headers: {
          /** @description Allowed methods: GET. */
          Allow?: 'GET';
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'method_not_allowed';
          };
        };
      };
      /** @description Unexpected server error (HTTP 500). `id` identifies the failure in the server log. */
      default: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerInternalError'];
        };
      };
    };
  };
  getInfra: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description Infrastructure info. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['infra-info'];
        };
      };
      /** @description No valid bearer token. */
      401: {
        headers: {
          'WWW-Authenticate': components['headers']['WWWAuthenticate'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'invalid_token';
          };
        };
      };
      /** @description Token lacks the `admin:view` scope (the `WWW-Authenticate` header is present), or the caller lacks the admin role (no `WWW-Authenticate` header). */
      403: {
        headers: {
          'WWW-Authenticate': components['headers']['WWWAuthenticate'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'invalid_token';
          };
        };
      };
      /** @description Only GET is allowed. */
      405: {
        headers: {
          /** @description Allowed methods: GET. */
          Allow?: 'GET';
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'method_not_allowed';
          };
        };
      };
      /** @description Unexpected server error (HTTP 500). `id` identifies the failure in the server log. */
      default: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerInternalError'];
        };
      };
    };
  };
  getEvents: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    requestBody?: never;
    responses: {
      /** @description The event stream. */
      200: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'text/event-stream': string;
        };
      };
      /** @description No valid bearer token. */
      401: {
        headers: {
          'WWW-Authenticate': components['headers']['WWWAuthenticate'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'invalid_token';
          };
        };
      };
      /** @description Token lacks the `admin:view` scope (the `WWW-Authenticate` header is present), or the caller lacks the admin role (no `WWW-Authenticate` header). */
      403: {
        headers: {
          'WWW-Authenticate': components['headers']['WWWAuthenticate'];
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'invalid_token';
          };
        };
      };
      /** @description Only GET is allowed. */
      405: {
        headers: {
          /** @description Allowed methods: GET. */
          Allow?: 'GET';
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerError'] & {
            /** @enum {unknown} */
            error?: 'method_not_allowed';
          };
        };
      };
      /** @description Unexpected server error (HTTP 500). `id` identifies the failure in the server log. */
      default: {
        headers: {
          [name: string]: unknown;
        };
        content: {
          'application/json': components['schemas']['ViewerInternalError'];
        };
      };
    };
  };
}
