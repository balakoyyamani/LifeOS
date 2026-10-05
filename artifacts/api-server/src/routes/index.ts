import { Router, type IRouter } from "express";
import healthRouter from "./health";
import goalsRouter from "./goals";
import todayRouter from "./today";
import pushRouter from "./push";
import tasksRouter from "./tasks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(goalsRouter);
router.use(todayRouter);
router.use(pushRouter);
router.use(tasksRouter);

export default router;

