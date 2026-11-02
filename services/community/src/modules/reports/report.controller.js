import * as reports from './report.service.js';

export async function createReport(req, res) {
  res.status(201).json(await reports.createReport(req.user.id, req.body));
}
