import {
  APP_URL,
  TEST_SHOP,
  expectExitIframeRedirect,
  getThrownResponse,
  mockGraphqlRequest,
  setUpEmbeddedFlow,
  setUpFetchFlow,
} from '../../../../__test-helpers';
import {REAUTH_URL_HEADER} from '../../../const';

import * as responses from './mock-responses';

it('returns scopes information', async () => {
  // GIVEN
  const {scopes} = await setUpEmbeddedFlow();
  await mockGraphqlRequest()(200, responses.WITH_GRANTED_AND_DECLARED);

  // WHEN
  const result = await scopes.query();

  // THEN
  expect(result).not.toBeUndefined();
  expect(result.granted.required).toEqual(['read_orders']);
  expect(result.granted.optional).toEqual(['write_customers']);
  expect(result.declared.required).toEqual(['write_orders', 'read_reports']);
});

it('redirects to exit-iframe with authentication using app bridge when embedded and Shopify invalidated the session', async () => {
  // GIVEN
  const {scopes} = await setUpEmbeddedFlow();
  const requestMock = await mockGraphqlRequest()(401);

  // WHEN
  const response = await getThrownResponse(
    async () => scopes.query(),
    requestMock,
  );

  // THEN
  expectExitIframeRedirect(response);
});

it('returns app bridge redirection during request headers when Shopify invalidated the session', async () => {
  // GIVEN
  const {scopes} = await setUpFetchFlow({
    unstable_newEmbeddedAuthStrategy: false,
  });
  const requestMock = await mockGraphqlRequest()(401);

  // WHEN
  const response = await getThrownResponse(
    async () => scopes.query(),
    requestMock,
  );

  // THEN
  expect(response.status).toEqual(401);

  const {origin, pathname, searchParams} = new URL(
    response.headers.get(REAUTH_URL_HEADER)!,
  );
  expect(origin).toEqual(APP_URL);
  expect(pathname).toEqual('/auth');
  expect(searchParams.get('shop')).toEqual(TEST_SHOP);
});

it('return an unexpected error when there is no authentication error', async () => {
  // GIVEN
  const {scopes} = await setUpFetchFlow({
    unstable_newEmbeddedAuthStrategy: false,
  });
  await mockGraphqlRequest()(500);

  // WHEN / THEN
  try {
    await scopes.query();
  } catch (error) {
    expect(error.status).toEqual(500);
  }
});
