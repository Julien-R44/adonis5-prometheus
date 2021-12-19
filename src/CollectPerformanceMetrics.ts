import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { Metrics } from './Metrics'

export class CollectPerformanceMetrics {
  constructor(protected metrics: Metrics, protected config: any) {}

  public async handle(
    { request, response, route }: HttpContextContract,
    next: () => Promise<void>
  ) {
    const httpMetricOptions = this.config.httpMetric

    /**
     * Start HTTP request timer ( if route not excluded ) with the
     * given options for url parsing.
     * The timer will be stopped when the request is finished.
     */
    let stopHttpRequestTimer
    if (httpMetricOptions.enabled) {
      const includeRouteParams = httpMetricOptions.includeRouteParams
      const includeQueryParams = httpMetricOptions.includeQueryParams
      const excludedRoutes = httpMetricOptions.excludedRoutes || []

      if (!excludedRoutes.includes(route?.pattern)) {
        let url = includeRouteParams ? request.url() : route?.pattern

        if (includeQueryParams && request.parsedUrl.query) {
          url += `?${request.parsedUrl.query}`
        }

        stopHttpRequestTimer = this.metrics.httpMetric.startTimer({
          method: request.method(),
          url,
        })
      }
    }

    /**
     * Execute request and track metrics for the request.
     * If the request fails with any error, we have to catch
     * this errror, track metricks, then rethrow the error.
     */
    try {
      await next()
      this.afterRequest(response.response.statusCode, stopHttpRequestTimer)
    } catch (err) {
      this.afterRequest(err.status || 500, stopHttpRequestTimer)
      throw err
    }
  }

  private async afterRequest(statusCode: number, stopHttpRequestTimer) {
    const enableThroughputMetric = this.config.throughputMetric.enabled
    const httpMetricOptions = this.config.httpMetric

    /**
     * Track request throughput..
     */
    if (enableThroughputMetric) this.metrics.throughputMetric.inc()

    /**
     * End HTTP request timer.
     */
    if (httpMetricOptions.enabled && stopHttpRequestTimer) {
      stopHttpRequestTimer({ statusCode })
    }
  }
}
