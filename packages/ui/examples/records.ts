// Fixtures use the same {id, fields} shape as airgen's useRecords output.
export interface Task {
  id: string;
  fields: {title: string; done: boolean};
}

export interface Project {
  id: string;
  fields: {name: string; status: string; owner: string; hours: number; tasks: Task[]};
}

export const projects: Project[] = [
  {
    id: 'project1',
    fields: {
      name: 'Website',
      status: 'Active',
      owner: 'Pedro',
      hours: 12,
      tasks: [{id: 'task1', fields: {title: 'Design homepage', done: true}}],
    },
  },
  {id: 'project2', fields: {name: 'Campaign', status: 'Active', owner: 'Ana', hours: 8, tasks: []}},
];
