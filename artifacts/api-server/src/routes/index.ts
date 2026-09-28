import { Router, type IRouter } from "express";
import healthRouter from "./health";
import goalsRouter from "./goals";
import todayRouter from "./today";

const router: IRouter = Router();

router.use(healthRouter);
router.use(goalsRouter);
router.use(todayRouter);

export default router;
