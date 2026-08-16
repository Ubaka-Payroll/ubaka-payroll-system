const bearerAuth = [{ bearerAuth: [] }]

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Ubaka Management Portal API',
    version: '1.0.0',
    description:
      'API for the Ubaka Management Portal. System Admins manage owner requests, subscriptions and activation keys; Site Owners manage Field Engineers, keys and daily reports.',
  },
  servers: [{ url: '/api', description: 'API base path' }],
  tags: [
    { name: 'Auth', description: 'Authentication and access requests' },
    { name: 'Admin', description: 'System Admin operations (role: SYSTEM_ADMIN)' },
    { name: 'Owner', description: 'Site Owner operations (role: SITE_OWNER)' },
    { name: 'System', description: 'Health and diagnostics' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste the token returned by /auth/login.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
      Role: {
        type: 'string',
        enum: ['SYSTEM_ADMIN', 'SITE_OWNER', 'FIELD_ENGINEER'],
      },
      AuthUser: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { $ref: '#/components/schemas/Role' },
          fullName: { type: 'string' },
          companyName: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@ubaka.site' },
          password: { type: 'string', format: 'password', example: 'password123' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: { $ref: '#/components/schemas/AuthUser' },
        },
      },
      RequestAccessRequest: {
        type: 'object',
        required: ['fullName', 'email', 'companyName', 'phone'],
        properties: {
          fullName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          companyName: { type: 'string' },
          phone: { type: 'string' },
          message: { type: 'string' },
        },
      },
      OwnerRequest: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          fullName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          companyName: { type: 'string' },
          phone: { type: 'string' },
          message: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
          rejectionReason: { type: 'string', nullable: true },
          reviewedBy: { type: 'string', nullable: true },
          reviewedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ApproveRequestBody: {
        type: 'object',
        properties: {
          seats: { type: 'integer', default: 3, minimum: 1 },
          planName: { type: 'string', default: 'Site Standard' },
        },
      },
      ApproveResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          temporaryPassword: { type: 'string' },
          activationKeys: { type: 'array', items: { type: 'string' } },
        },
      },
      RejectRequestBody: {
        type: 'object',
        properties: { reason: { type: 'string' } },
      },
      Subscription: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ownerId: { type: 'string' },
          status: { type: 'string', enum: ['NONE', 'ACTIVE', 'EXPIRED', 'SUSPENDED'] },
          planName: { type: 'string' },
          seats: { type: 'integer' },
          startsAt: { type: 'string', format: 'date-time', nullable: true },
          endsAt: { type: 'string', format: 'date-time', nullable: true },
          ownerName: { type: 'string', nullable: true },
          ownerEmail: { type: 'string', nullable: true },
          companyName: { type: 'string', nullable: true },
          keysIssued: { type: 'integer', nullable: true },
          keysUsed: { type: 'integer', nullable: true },
        },
      },
      IssueKeysBody: {
        type: 'object',
        properties: { count: { type: 'integer', default: 1, minimum: 1, maximum: 20 } },
      },
      IssueKeysResponse: {
        type: 'object',
        properties: { keys: { type: 'array', items: { type: 'string' } } },
      },
      UpdateSubStatusBody: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED'] } },
      },
      ActivationKey: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          key: { type: 'string' },
          ownerId: { type: 'string' },
          engineerId: { type: 'string', nullable: true },
          siteName: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['AVAILABLE', 'ASSIGNED', 'USED', 'REVOKED'] },
          createdAt: { type: 'string', format: 'date-time' },
          usedAt: { type: 'string', format: 'date-time', nullable: true },
          engineerName: { type: 'string', nullable: true },
          engineerEmail: { type: 'string', nullable: true },
        },
      },
      FieldEngineer: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ownerId: { type: 'string' },
          fullName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string', nullable: true },
          siteName: { type: 'string' },
          status: { type: 'string', enum: ['PENDING_ACTIVATION', 'ACTIVE', 'DISABLED'] },
          activationKey: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          activatedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      CreateEngineerBody: {
        type: 'object',
        required: ['fullName', 'email', 'siteName'],
        properties: {
          fullName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          siteName: { type: 'string' },
        },
      },
      DailyReportRow: {
        type: 'object',
        properties: {
          worker_id: { type: 'integer' },
          worker_number: { type: 'string' },
          full_name: { type: 'string' },
          classification: { type: 'string' },
          entry_time: { type: 'string', format: 'date-time', nullable: true },
          exit_time: { type: 'string', format: 'date-time', nullable: true },
          break_count: { type: 'integer' },
          break_minutes: { type: 'integer', nullable: true },
          hours_worked: { type: 'number', nullable: true },
          daily_wage: { type: 'number', nullable: true },
        },
      },
      DailyReportMeta: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ownerId: { type: 'string' },
          engineerId: { type: 'string' },
          siteName: { type: 'string' },
          reportDate: { type: 'string', format: 'date' },
          workersPresent: { type: 'integer' },
          completedShifts: { type: 'integer' },
          activeOnSite: { type: 'integer' },
          totalWages: { type: 'number' },
          receivedAt: { type: 'string', format: 'date-time' },
        },
      },
      DailyReport: {
        allOf: [
          { $ref: '#/components/schemas/DailyReportMeta' },
          {
            type: 'object',
            properties: {
              rows: { type: 'array', items: { $ref: '#/components/schemas/DailyReportRow' } },
            },
          },
        ],
      },
    },
    responses: {
      Unauthorized: {
        description: 'Missing or invalid token',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Insufficient permissions for this role',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Service status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    service: { type: 'string' },
                    users: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a JWT',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: {
            description: 'Authenticated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } },
            },
          },
          400: { $ref: '#/components/responses/NotFound' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/request-access': {
      post: {
        tags: ['Auth'],
        summary: 'Submit a Site Owner access request',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RequestAccessRequest' } },
          },
        },
        responses: {
          201: {
            description: 'Request submitted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    request: {
                      type: 'object',
                      properties: { id: { type: 'string' }, status: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
          409: {
            description: 'Duplicate account or pending request',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current authenticated user',
        security: bearerAuth,
        responses: {
          200: {
            description: 'Current user',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthUser' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/admin/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Admin dashboard overview',
        security: bearerAuth,
        responses: {
          200: { description: 'Overview counts, recent requests and subscriptions' },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/admin/requests': {
      get: {
        tags: ['Admin'],
        summary: 'List all owner access requests',
        security: bearerAuth,
        responses: {
          200: {
            description: 'Owner requests',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/OwnerRequest' } },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/admin/requests/{id}/approve': {
      post: {
        tags: ['Admin'],
        summary: 'Approve an owner request (creates owner, subscription and keys)',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ApproveRequestBody' } },
          },
        },
        responses: {
          200: {
            description: 'Approved',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApproveResponse' } },
            },
          },
          400: { description: 'Request is not pending' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/admin/requests/{id}/reject': {
      post: {
        tags: ['Admin'],
        summary: 'Reject an owner request',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RejectRequestBody' } },
          },
        },
        responses: {
          200: { description: 'Rejected' },
          400: { description: 'Request is not pending' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/admin/subscriptions': {
      get: {
        tags: ['Admin'],
        summary: 'List subscriptions with key usage',
        security: bearerAuth,
        responses: {
          200: {
            description: 'Subscriptions',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Subscription' } },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/admin/subscriptions/{ownerId}/keys': {
      post: {
        tags: ['Admin'],
        summary: 'Issue additional activation keys for an owner',
        security: bearerAuth,
        parameters: [{ name: 'ownerId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/IssueKeysBody' } },
          },
        },
        responses: {
          201: {
            description: 'Keys issued',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/IssueKeysResponse' } },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/admin/subscriptions/{id}/status': {
      patch: {
        tags: ['Admin'],
        summary: 'Update a subscription status',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateSubStatusBody' } },
          },
        },
        responses: {
          200: { description: 'Updated' },
          400: { description: 'Invalid status' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/owner/overview': {
      get: {
        tags: ['Owner'],
        summary: 'Site Owner dashboard overview',
        security: bearerAuth,
        responses: {
          200: { description: 'Subscription, engineer/key counts and latest reports' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/owner/engineers': {
      get: {
        tags: ['Owner'],
        summary: 'List the owner\'s Field Engineers',
        security: bearerAuth,
        responses: {
          200: {
            description: 'Field Engineers',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/FieldEngineer' } },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
      post: {
        tags: ['Owner'],
        summary: 'Create a Field Engineer and auto-assign an activation key',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateEngineerBody' } },
          },
        },
        responses: {
          201: {
            description: 'Engineer created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/FieldEngineer' } },
            },
          },
          400: { description: 'No available keys or missing fields' },
          403: { description: 'Active subscription required' },
          409: { description: 'Engineer email already exists' },
        },
      },
    },
    '/owner/keys': {
      get: {
        tags: ['Owner'],
        summary: 'List the owner\'s activation keys',
        security: bearerAuth,
        responses: {
          200: {
            description: 'Activation keys',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/ActivationKey' } },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/owner/reports': {
      get: {
        tags: ['Owner'],
        summary: 'List daily reports (metadata only)',
        security: bearerAuth,
        responses: {
          200: {
            description: 'Daily report summaries',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/DailyReportMeta' } },
              },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/owner/reports/{id}': {
      get: {
        tags: ['Owner'],
        summary: 'Get a full daily report with worker rows',
        security: bearerAuth,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Daily report',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/DailyReport' } },
            },
          },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
  security: [],
} as const
