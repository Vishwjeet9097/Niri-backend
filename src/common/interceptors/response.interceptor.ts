import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  status: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        // Skip transformation for error responses
        if (response.statusCode >= 400) {
          return data;
        }

        // Skip transformation if data is already in the correct format
        if (data && typeof data === 'object' && 'status' in data && 'data' in data) {
          return data;
        }

        // Skip transformation for specific endpoints that return objects directly
        const url = request.url;
        if (
          url.includes('/submission') &&
          request.method === 'POST' &&
          !url.includes('/submit-to-state') &&
          !url.includes('/forward-to-mospi') &&
          !url.includes('/state-reject') &&
          !url.includes('/final-reject') &&
          !url.includes('/approve') &&
          !url.includes('/resubmit')
        ) {
          return data;
        }

        // Transform successful responses
        return {
          status: true,
          data: data,
          message: this.getMessageFromContext(context),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private getMessageFromContext(context: ExecutionContext): string {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;

    // Generate appropriate message based on endpoint
    if (url.includes('/auth/login')) {
      return 'Login successful';
    } else if (url.includes('/auth/register')) {
      return 'User registered successfully';
    } else if (url.includes('/submission') && method === 'POST') {
      return 'Submission created successfully';
    } else if (url.includes('/submission') && method === 'PATCH') {
      return 'Submission updated successfully';
    } else if (url.includes('/submission') && method === 'GET') {
      return 'Submission retrieved successfully';
    } else if (url.includes('/submit-to-state')) {
      return 'Submission submitted to state successfully';
    } else if (url.includes('/forward-to-mospi')) {
      return 'Submission forwarded to MoSPI successfully';
    } else if (url.includes('/state-reject')) {
      return 'Submission rejected by state successfully';
    } else if (url.includes('/final-reject')) {
      return 'Submission rejected by MoSPI successfully';
    } else if (url.includes('/approve')) {
      return 'Submission approved successfully';
    } else if (url.includes('/resubmit')) {
      return 'Submission resubmitted successfully';
    } else if (url.includes('/dashboard')) {
      return 'Dashboard data retrieved successfully';
    } else if (url.includes('/report')) {
      return 'Report data retrieved successfully';
    } else if (url.includes('/file/upload')) {
      return 'File uploaded successfully';
    } else if (url.includes('/file') && method === 'DELETE') {
      return 'File deleted successfully';
    } else if (url.includes('/users') && method === 'GET') {
      return 'Users retrieved successfully';
    } else if (url.includes('/audit')) {
      return 'Audit data retrieved successfully';
    } else if (url.includes('/health')) {
      return 'Health check successful';
    }

    return 'Request processed successfully';
  }
}
