import { CustomFetchApi } from "@shopify/graphql-client";

import { AdminApiClientOptions } from "../types";

export enum Method {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Delete = "DELETE",
}

type SearchParamField = string | number;
export type SearchParamFields =
  | SearchParamField
  | SearchParamField[]
  | { [key: string]: SearchParamField | SearchParamField[] };
export interface SearchParams {
  [key: string]: SearchParamFields;
}

export interface HeaderOptions {
  [key: string]: string | number | string[];
}

export interface GetRequestOptions {
  headers?: HeaderOptions;
  data?: { [key: string]: any } | string;
  searchParams?: SearchParams;
  retries?: number;
  apiVersion?: string;
}

export interface PostRequestOptions extends GetRequestOptions {
  data: Required<GetRequestOptions>["data"];
}

export interface PutRequestOptions extends PostRequestOptions {}

export interface DeleteRequestOptions extends GetRequestOptions {}

export interface AdminRestApiClientOptions
  extends Omit<AdminApiClientOptions, "headers"> {
  scheme?: "https" | "http";
  defaultRetryTime?: number;
  formatPaths?: boolean;
}

export type RequestOptions = (GetRequestOptions | PostRequestOptions) & {
  method: Method;
};

export interface AdminRestApiClient {
  get: (
    path: string,
    options?: GetRequestOptions,
  ) => ReturnType<CustomFetchApi>;
  put: (
    path: string,
    options?: PutRequestOptions,
  ) => ReturnType<CustomFetchApi>;
  post: (
    path: string,
    options?: PostRequestOptions,
  ) => ReturnType<CustomFetchApi>;
  delete: (
    path: string,
    options?: DeleteRequestOptions,
  ) => ReturnType<CustomFetchApi>;
}
