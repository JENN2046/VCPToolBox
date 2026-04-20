'use strict';

const WORKFLOWS = {
  meeting_automation: {
    name: 'meeting_automation',
    description: 'query availability, create meeting, create todo, create report',
    steps: [
      {
        id: 'query_calendar_slots',
        product: 'calendar',
        tool: 'busy search',
        argsTemplate: {
          users: '{{input.users}}',
          start: '{{input.start}}',
          end: '{{input.end}}'
        },
        write: false
      },
      {
        id: 'create_calendar_event',
        product: 'calendar',
        tool: 'event create',
        argsTemplate: {
          title: '{{input.title}}',
          start: '{{input.start}}',
          end: '{{input.end}}',
          desc: '{{input.desc}}'
        },
        write: true
      },
      {
        id: 'create_followup_todo',
        product: 'todo',
        tool: 'task create',
        argsTemplate: {
          title: '{{input.todo_title}}',
          executors: '{{input.todo_executors}}',
          due: '{{input.todo_due_time}}',
          priority: '{{input.todo_priority}}'
        },
        write: true
      },
      {
        id: 'generate_meeting_report',
        product: 'report',
        tool: 'create',
        argsTemplate: {
          template_id: '{{input.report_template_id}}',
          contents: '{{input.report_contents}}'
        },
        write: true
      }
    ]
  },
  customer_followup: {
    name: 'customer_followup',
    description: 'read ai table, find owner, send ding, create follow-up todo',
    steps: [
      {
        id: 'read_customer_table',
        product: 'aitable',
        tool: 'record query',
        argsTemplate: {
          base_id: '{{input.base_id}}',
          table_id: '{{input.table_id}}',
          query: '{{input.query}}'
        },
        write: false
      },
      {
        id: 'query_contact_owner',
        product: 'contact',
        tool: 'user search',
        argsTemplate: {
          keyword: '{{input.owner_keyword}}'
        },
        write: false
      },
      {
        id: 'send_ding_notice',
        product: 'chat',
        tool: 'message send-by-bot',
        argsTemplate: {
          robot_code: '{{input.robot_code}}',
          users: '{{input.ding_users}}',
          title: '{{input.ding_title}}',
          text: '{{input.ding_content}}'
        },
        write: true
      },
      {
        id: 'create_followup_todo',
        product: 'todo',
        tool: 'task create',
        argsTemplate: {
          title: '{{input.followup_title}}',
          executors: '{{input.followup_executors}}',
          due: '{{input.followup_due_time}}',
          priority: '{{input.followup_priority}}'
        },
        write: true
      }
    ]
  },
  daily_report_generation: {
    name: 'daily_report_generation',
    description: 'aggregate todo + attendance, create report, notify via bot',
    steps: [
      {
        id: 'list_completed_todo',
        product: 'todo',
        tool: 'task list',
        argsTemplate: {
          page: '{{input.todo_page}}',
          size: '{{input.todo_size}}',
          status: '{{input.todo_status}}'
        },
        write: false
      },
      {
        id: 'get_attendance',
        product: 'attendance',
        tool: 'record get',
        argsTemplate: {
          user: '{{input.user}}',
          date: '{{input.date}}'
        },
        write: false
      },
      {
        id: 'generate_report',
        product: 'report',
        tool: 'create',
        argsTemplate: {
          template_id: '{{input.report_template_id}}',
          contents: '{{input.report_contents}}'
        },
        write: true
      },
      {
        id: 'send_bot_message',
        product: 'chat',
        tool: 'message send-by-bot',
        argsTemplate: {
          robot_code: '{{input.robot_code}}',
          users: '{{input.chat_users}}',
          title: '{{input.chat_title}}',
          text: '{{input.chat_text}}'
        },
        write: true
      }
    ]
  }
};

function getWorkflowDefinition(name) {
  return WORKFLOWS[name] || null;
}

function listWorkflowNames() {
  return Object.keys(WORKFLOWS);
}

module.exports = {
  WORKFLOWS,
  getWorkflowDefinition,
  listWorkflowNames
};
