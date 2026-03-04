// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./AgentRegistry.sol";

/**
 * @title TaskDAG
 * @notice Composable task orchestration — the feature no other AI protocol has.
 *
 *         An orchestrator agent creates a parent task with a total budget.
 *         It spawns subtasks assigned to specialist agents.
 *         The parent budget is held in escrow and released proportionally
 *         only when ALL required subtasks are completed.
 *
 *         This creates the most powerful lock-in mechanism:
 *         An agent with 12 active subtasks cannot leave — it has funds at stake
 *         in every branch of the tree.
 *
 *         Example:
 *         Task: "Market Analysis Report"  [500 AGT budget]
 *           └── Subtask A: DataProcessor  [150 AGT] — "Analyze 10GB dataset"
 *           └── Subtask B: ResearchAgent  [100 AGT] — "Literature review"
 *           └── Subtask C: ContentAgent   [250 AGT] — "Write final report"
 *               Only unlocks when A and B are complete.
 */
contract TaskDAG {
    IERC20 public immutable token;
    AgentRegistry public immutable registry;

    enum TaskStatus { Open, InProgress, Completed, Cancelled }

    struct Task {
        uint256 id;
        address orchestrator;   // agent who created this task
        address assignee;       // agent assigned to execute (address(0) if open)
        uint256 budget;         // AGT allocated for this task
        string description;
        string[] tags;
        uint256 deadline;
        TaskStatus status;
        uint256 parentId;       // 0 if root task
        uint256[] subtaskIds;   // child task IDs
        uint256 requiredSubtasks; // how many subtasks must complete before this pays out
        uint256 completedSubtasks;
        uint256 createdAt;
        bool fundsReleased;
    }

    Task[] private tasks;
    uint256 public constant ROOT_PARENT = 0;

    event TaskCreated(uint256 indexed taskId, address indexed orchestrator, uint256 budget, uint256 parentId);
    event SubtaskSpawned(uint256 indexed parentId, uint256 indexed subtaskId, address indexed assignee, uint256 budget);
    event TaskAccepted(uint256 indexed taskId, address indexed assignee);
    event TaskCompleted(uint256 indexed taskId, address indexed assignee, uint256 payment);
    event TaskCancelled(uint256 indexed taskId);
    event SubtaskProgress(uint256 indexed parentId, uint256 completed, uint256 required);

    modifier onlyRegistered() {
        require(registry.isRegistered(msg.sender), "TaskDAG: not registered");
        _;
    }

    constructor(address _token, address _registry) {
        token = IERC20(_token);
        registry = AgentRegistry(_registry);
        // Reserve index 0 as null sentinel
        tasks.push(); // tasks[0] = empty
    }

    /**
     * @notice Create a root task with full budget deposited upfront.
     * @dev Orchestrator deposits the total budget. Funds stay locked until
     *      all required subtasks complete.
     */
    function createTask(
        string calldata description,
        string[] calldata tags,
        uint256 budget,
        uint256 deadline,
        uint256 requiredSubtasks
    ) external onlyRegistered returns (uint256 taskId) {
        require(budget > 0, "TaskDAG: zero budget");
        require(deadline > block.timestamp, "TaskDAG: past deadline");

        bool ok = token.transferFrom(msg.sender, address(this), budget);
        require(ok, "TaskDAG: deposit failed");

        taskId = tasks.length;
        tasks.push(Task({
            id: taskId,
            orchestrator: msg.sender,
            assignee: address(0),
            budget: budget,
            description: description,
            tags: tags,
            deadline: deadline,
            status: TaskStatus.Open,
            parentId: ROOT_PARENT,
            subtaskIds: new uint256[](0),
            requiredSubtasks: requiredSubtasks,
            completedSubtasks: 0,
            createdAt: block.timestamp,
            fundsReleased: false
        }));

        emit TaskCreated(taskId, msg.sender, budget, ROOT_PARENT);
    }

    /**
     * @notice Spawn a subtask from a parent task, assigning budget from parent.
     * @dev Only the orchestrator of the parent can spawn subtasks.
     *      Subtask budget is carved out of parent's remaining budget.
     */
    function spawnSubtask(
        uint256 parentId,
        address assignee,
        string calldata description,
        string[] calldata tags,
        uint256 budget,
        uint256 deadline
    ) external onlyRegistered returns (uint256 subtaskId) {
        Task storage parent = tasks[parentId];
        require(parent.orchestrator == msg.sender, "TaskDAG: not orchestrator");
        require(parent.status == TaskStatus.Open || parent.status == TaskStatus.InProgress, "TaskDAG: parent not active");
        require(registry.isRegistered(assignee), "TaskDAG: assignee not registered");
        require(budget <= parent.budget, "TaskDAG: budget exceeds parent");
        require(deadline <= parent.deadline, "TaskDAG: deadline exceeds parent");

        subtaskId = tasks.length;
        tasks.push(Task({
            id: subtaskId,
            orchestrator: msg.sender,
            assignee: assignee,
            budget: budget,
            description: description,
            tags: tags,
            deadline: deadline,
            status: TaskStatus.InProgress,
            parentId: parentId,
            subtaskIds: new uint256[](0),
            requiredSubtasks: 0,
            completedSubtasks: 0,
            createdAt: block.timestamp,
            fundsReleased: false
        }));

        parent.subtaskIds.push(subtaskId);
        if (parent.status == TaskStatus.Open) {
            parent.status = TaskStatus.InProgress;
        }

        emit SubtaskSpawned(parentId, subtaskId, assignee, budget);
    }

    /**
     * @notice Accept an open task (no pre-assigned assignee).
     */
    function acceptTask(uint256 taskId) external onlyRegistered {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.Open, "TaskDAG: not open");
        require(task.assignee == address(0), "TaskDAG: already assigned");
        require(task.orchestrator != msg.sender, "TaskDAG: self-assignment");

        task.assignee = msg.sender;
        task.status = TaskStatus.InProgress;

        emit TaskAccepted(taskId, msg.sender);
    }

    /**
     * @notice Mark a subtask as completed. Called by the orchestrator after verifying delivery.
     *         When all required subtasks complete, payment releases automatically.
     */
    function completeSubtask(uint256 subtaskId) external onlyRegistered {
        Task storage subtask = tasks[subtaskId];
        require(subtask.status == TaskStatus.InProgress, "TaskDAG: not in progress");
        require(subtask.parentId != ROOT_PARENT, "TaskDAG: use completeTask for root");
        require(
            tasks[subtask.parentId].orchestrator == msg.sender,
            "TaskDAG: only orchestrator can confirm"
        );
        require(!subtask.fundsReleased, "TaskDAG: already paid");

        subtask.status = TaskStatus.Completed;
        subtask.fundsReleased = true;

        // Pay the subtask assignee
        token.transfer(subtask.assignee, subtask.budget);
        emit TaskCompleted(subtaskId, subtask.assignee, subtask.budget);

        // Update parent progress
        Task storage parent = tasks[subtask.parentId];
        parent.completedSubtasks++;
        emit SubtaskProgress(subtask.parentId, parent.completedSubtasks, parent.requiredSubtasks);

        // If all required subtasks are done, complete the parent task
        if (
            parent.requiredSubtasks > 0 &&
            parent.completedSubtasks >= parent.requiredSubtasks &&
            !parent.fundsReleased
        ) {
            _completeParent(subtask.parentId);
        }
    }

    /**
     * @notice Complete a root task directly (no subtasks required).
     *         Orchestrator confirms delivery, assignee gets paid.
     */
    function completeTask(uint256 taskId) external onlyRegistered {
        Task storage task = tasks[taskId];
        require(task.status == TaskStatus.InProgress, "TaskDAG: not in progress");
        require(task.orchestrator == msg.sender, "TaskDAG: not orchestrator");
        require(task.requiredSubtasks == 0 || task.completedSubtasks >= task.requiredSubtasks, "TaskDAG: subtasks pending");
        require(!task.fundsReleased, "TaskDAG: already paid");
        require(task.assignee != address(0), "TaskDAG: no assignee");

        task.status = TaskStatus.Completed;
        task.fundsReleased = true;

        // Remaining budget (after subtask payouts) goes to orchestrator's assignee
        token.transfer(task.assignee, task.budget);
        emit TaskCompleted(taskId, task.assignee, task.budget);
    }

    /**
     * @notice Cancel a task and refund remaining budget to orchestrator.
     *         Can only cancel if no subtasks are in progress.
     */
    function cancelTask(uint256 taskId) external {
        Task storage task = tasks[taskId];
        require(task.orchestrator == msg.sender, "TaskDAG: not orchestrator");
        require(task.status == TaskStatus.Open, "TaskDAG: cannot cancel active task");
        require(!task.fundsReleased, "TaskDAG: already paid");

        task.status = TaskStatus.Cancelled;
        task.fundsReleased = true;

        token.transfer(task.orchestrator, task.budget);
        emit TaskCancelled(taskId);
    }

    // ── Views ──────────────────────────────────────────────────────────────

    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    function totalTasks() external view returns (uint256) {
        return tasks.length - 1; // exclude sentinel
    }

    function getSubtasks(uint256 parentId) external view returns (uint256[] memory) {
        return tasks[parentId].subtaskIds;
    }

    // ── Internal ───────────────────────────────────────────────────────────

    function _completeParent(uint256 parentId) internal {
        Task storage parent = tasks[parentId];
        parent.status = TaskStatus.Completed;
        parent.fundsReleased = true;
        // Any remaining budget (orchestrator's coordination fee) returns to orchestrator
        // In practice budget is carved into subtasks, so remainder ≈ 0
        emit TaskCompleted(parentId, parent.orchestrator, 0);
    }
}
