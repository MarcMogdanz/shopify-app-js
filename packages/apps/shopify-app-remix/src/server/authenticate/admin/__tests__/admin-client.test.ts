import {
  ApiVersion,
  HttpMaxRetriesError,
  LATEST_API_VERSION,
  SESSION_COOKIE_NAME,
  Session,
} from '@shopify/shopify-api';
import {restResources} from '@shopify/shopify-api/rest/admin/2023-04';

import {
  APP_URL,
  TEST_SHOP,
  getThrownResponse,
  setUpValidSession,
  signRequestCookie,
  testConfig,
  mockExternalRequest,
  expectAdminApiClient,
  setUpEmbeddedFlow,
  mockGraphqlRequest,
} from '../../../__test-helpers';
import {shopifyApp} from '../../..';
import {AdminApiContext} from '../../../clients';

describe('admin.authenticate context', () => {
  expectAdminApiClient(async () => {
    const {
      admin,
      expectedSession,
      session: actualSession,
    } = await setUpEmbeddedFlow();

    return {admin, expectedSession, actualSession};
  });

  it('re-throws errors other than HttpResponseErrors on GraphQL requests', async () => {
    // GIVEN
    const {admin} = await setUpEmbeddedFlow();

    // WHEN
    await mockGraphqlRequest()(429);
    await mockGraphqlRequest()(429);

    // THEN
    await expect(async () =>
      admin.graphql(
        'mutation myMutation($ID: String!) { shop(ID: $ID) { name } }',
        {variables: {ID: '123'}, tries: 2},
      ),
    ).rejects.toThrowError(HttpMaxRetriesError);
  });

  it('re-throws errors other than HttpResponseErrors on REST requests', async () => {
    // GIVEN
    const {admin} = await setUpEmbeddedFlow();

    // WHEN
    await mockRestRequest(429);
    await mockRestRequest(429);

    // THEN
    await expect(async () =>
      admin.rest.get({path: '/customers.json', tries: 2}),
    ).rejects.toThrowError(HttpMaxRetriesError);
  });

  describe.each([
    {
      testGroup: 'REST client',
      mockRequest: mockRestRequest,
      action: async (admin: AdminApiContext, _session: Session) =>
        admin.rest.get({path: '/customers.json'}),
    },
    {
      testGroup: 'REST resources',
      mockRequest: mockRestRequest,
      action: async (admin: AdminApiContext, session: Session) =>
        admin.rest.resources.Customer.all({session}),
    },
    {
      testGroup: 'GraphQL client',
      mockRequest: mockGraphqlRequest(),
      action: async (admin: AdminApiContext, _session: Session) =>
        admin.graphql('{ shop { name } }'),
    },
    {
      testGroup: 'GraphQL client with options',
      mockRequest: mockGraphqlRequest('2021-01' as ApiVersion),
      action: async (admin: AdminApiContext, _session: Session) =>
        admin.graphql(
          'mutation myMutation($ID: String!) { shop(ID: $ID) { name } }',
          {
            variables: {ID: '123'},
            apiVersion: '2021-01' as ApiVersion,
            headers: {custom: 'header'},
            tries: 2,
          },
        ),
    },
  ])(
    '$testGroup re-authentication',
    ({testGroup: _testGroup, mockRequest, action}) => {
      it('throws a response when request receives a non-401 response and not embedded', async () => {
        // GIVEN
        const {admin, session} = await setUpNonEmbeddedFlow();
        const requestMock = await mockRequest(403);

        // WHEN
        const response = await getThrownResponse(
          async () => action(admin, session),
          requestMock,
        );

        // THEN
        expect(response.status).toEqual(403);
      });
    },
  );

  it('can parse a nested response object', async () => {
    const {admin, session} = await setUpEmbeddedFlow();

    const body = {
      product: {
        id: 12345,
        title: 'Product title',
        variants: [
          {
            id: 54321,
            product_id: 12345,
            title: 'Variant title',
            price: '34.02',
          },
        ],
        options: [
          {
            id: 54321,
            product_id: 12345,
            name: 'Title',
            position: 1,
            values: ['Option title'],
          },
        ],
        images: [],
        image: null,
      },
    };

    await mockRestRequest(200, 'products/12345.json', body);

    const resource = await admin.rest.resources.Product.find({
      session,
      id: 12345,
    });
    const variants = resource!.variants! as InstanceType<
      (typeof admin)['rest']['resources']['Variant']
    >[];

    expect(resource!.title).toBe('Product title');
    expect(variants[0].title).toBe('Variant title');
  });
});

async function setUpNonEmbeddedFlow() {
  const shopify = shopifyApp(testConfig({restResources, isEmbeddedApp: false}));
  const session = await setUpValidSession(shopify.sessionStorage);

  const request = new Request(`${APP_URL}?shop=${TEST_SHOP}`);
  signRequestCookie({
    request,
    cookieName: SESSION_COOKIE_NAME,
    cookieValue: session.id,
  });

  return {
    shopify,
    ...(await shopify.authenticate.admin(request)),
  };
}

async function mockRestRequest(
  status: number,
  path = 'customers.json',
  response = {},
) {
  const requestMock = new Request(
    `https://${TEST_SHOP}/admin/api/${LATEST_API_VERSION}/${path}`,
  );

  await mockExternalRequest({
    request: requestMock,
    response: new Response(JSON.stringify(response), {status}),
  });

  return requestMock;
}
