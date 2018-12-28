import React, { PureComponent } from 'react';
import ReactTable from 'react-table';
import classNames from 'classnames';
import _ from 'lodash';
import * as utils from '../../datasource-zabbix/utils';
import { ProblemsPanelOptions, Trigger, ZBXEvent, GFTimeRange, RTCell, ZBXTag, TriggerSeverity, RTResized } from '../types';
import EventTag from './EventTag';
import ProblemDetails from './ProblemDetails';
import { AckProblemData } from './Modal';
import GFHeartIcon from './GFHeartIcon';

export interface ProblemListProps {
  problems: Trigger[];
  panelOptions: ProblemsPanelOptions;
  loading?: boolean;
  timeRange?: GFTimeRange;
  pageSize?: number;
  fontSize?: number;
  getProblemEvents: (ids: string[]) => ZBXEvent[];
  onProblemAck?: (problem: Trigger, data: AckProblemData) => void;
  onTagClick?: (tag: ZBXTag, datasource: string) => void;
  onPageSizeChange?: (pageSize: number, pageIndex: number) => void;
  onColumnResize?: (newResized: RTResized) => void;
}

interface ProblemListState {
  expanded: any;
  page: number;
}

export class ProblemList extends PureComponent<ProblemListProps, ProblemListState> {
  rootWidth: number;
  rootRef: any;

  constructor(props) {
    super(props);
    this.state = {
      expanded: {},
      page: 0,
    };
  }

  setRootRef = ref => {
    this.rootRef = ref;
  }

  handleProblemAck = (problem: Trigger, data: AckProblemData) => {
    return this.props.onProblemAck(problem, data);
  }

  handlePageSizeChange = (pageSize, pageIndex) => {
    if (this.props.onPageSizeChange) {
      this.props.onPageSizeChange(pageSize, pageIndex);
    }
  }

  handleResizedChange = (newResized, event) => {
    if (this.props.onColumnResize) {
      this.props.onColumnResize(newResized);
    }
  }

  handleExpandedChange = expanded => {
    const nextExpanded = { ...this.state.expanded };
    nextExpanded[this.state.page] = expanded;
    this.setState({
      expanded: nextExpanded
    });
  }

  handleTagClick = (tag: ZBXTag, datasource: string) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, datasource);
    }
  }

  getExpandedPage = (page: number) => {
    return this.state.expanded[page] || {};
  }

  buildColumns() {
    const result = [];
    const options = this.props.panelOptions;
    const problems = this.props.problems;
    const timeColWidth = problems && problems.length ? problems[0].lastchange.length * 9 : 160;
    const highlightNewerThan = options.highlightNewEvents && options.highlightNewerThan;
    const statusCell = props => StatusCell(props, options.okEventColor, DEFAULT_PROBLEM_COLOR, highlightNewerThan);
    const statusIconCell = props => StatusIconCell(props, highlightNewerThan);

    const columns = [
      { Header: 'Host', accessor: 'host', show: options.hostField },
      { Header: 'Host (Technical Name)', accessor: 'hostTechName', show: options.hostTechNameField },
      { Header: 'Host Groups', accessor: 'groups', show: options.hostGroups, Cell: GroupCell },
      { Header: 'Proxy', accessor: 'proxy', show: options.hostProxy },
      {
        Header: 'Severity', show: options.severityField, className: 'problem-severity', width: 120,
        accessor: problem => problem.priority,
        id: 'severity',
        Cell: props => SeverityCell(props, options.triggerSeverity, options.markAckEvents, options.ackEventColor),
      },
      {
        Header: '', id: 'statusIcon', show: options.statusIcon, className: 'problem-status-icon', width: 50,
        accessor: 'value',
        Cell: statusIconCell,
      },
      { Header: 'Status', accessor: 'value', show: options.statusField, width: 100, Cell: statusCell },
      { Header: 'Problem', accessor: 'description', minWidth: 200, Cell: ProblemCell},
      {
        Header: 'Tags', accessor: 'tags', show: options.showTags, className: 'problem-tags',
        Cell: props => <TagCell {...props} onTagClick={this.handleTagClick} />
      },
      {
        Header: 'Time', className: 'last-change', width: timeColWidth,
        accessor: 'lastchangeUnix',
        id: 'lastchange',
        Cell: row => row.original.lastchange,
      },
      { Header: '', className: 'custom-expander', width: 60, expander: true, Expander: CustomExpander },
    ];
    for (const column of columns) {
      if (column.show || column.show === undefined) {
        delete column.show;
        result.push(column);
      }
    }
    return result;
  }

  render() {
    const columns = this.buildColumns();
    this.rootWidth = this.rootRef && this.rootRef.clientWidth;
    const { pageSize, fontSize, panelOptions } = this.props;
    const panelClass = classNames('panel-problems', { [`font-size--${fontSize}`]: fontSize });
    let pageSizeOptions = [5, 10, 20, 25, 50, 100];
    if (pageSize) {
      pageSizeOptions.push(pageSize);
      pageSizeOptions = _.sortBy(pageSizeOptions);
    }

    return (
      <div className={panelClass} ref={this.setRootRef}>
        <ReactTable
          data={this.props.problems}
          columns={columns}
          defaultPageSize={10}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          resized={panelOptions.resizedColumns}
          minRows={0}
          loading={this.props.loading}
          noDataText="No problems found"
          SubComponent={props =>
            <ProblemDetails {...props}
              rootWidth={this.rootWidth}
              timeRange={this.props.timeRange}
              getProblemEvents={this.props.getProblemEvents}
              onProblemAck={this.handleProblemAck}
              onTagClick={this.handleTagClick}
            />
          }
          expanded={this.getExpandedPage(this.state.page)}
          onExpandedChange={this.handleExpandedChange}
          onPageChange={page => this.setState({ page })}
          onPageSizeChange={this.handlePageSizeChange}
          onResizedChange={this.handleResizedChange}
        />
      </div>
    );
  }
}

function SeverityCell(props: RTCell<Trigger>, problemSeverityDesc: TriggerSeverity[], markAckEvents?: boolean, ackEventColor?: string) {
  const problem = props.original;
  let color: string;
  const severityDesc = _.find(problemSeverityDesc, s => s.priority === Number(props.original.priority));
  color = severityDesc.color;

  // Mark acknowledged triggers with different color
  if (markAckEvents && problem.acknowledges && problem.acknowledges.length) {
    color = ackEventColor;
  }

  return (
    <div className='severity-cell' style={{ background: color }}>
      {severityDesc.severity}
    </div>
  );
}

const DEFAULT_OK_COLOR = 'rgb(56, 189, 113)';
const DEFAULT_PROBLEM_COLOR = 'rgb(215, 0, 0)';

function StatusCell(props: RTCell<Trigger>, okColor = DEFAULT_OK_COLOR, problemColor = DEFAULT_PROBLEM_COLOR, highlightNewerThan?: string) {
  const status = props.value === '0' ? 'RESOLVED' : 'PROBLEM';
  const color = props.value === '0' ? okColor : problemColor;
  let newProblem = false;
  if (highlightNewerThan) {
    newProblem = isNewProblem(props.original, highlightNewerThan);
  }
  return (
    <span className={newProblem ? 'problem-status--new' : ''} style={{ color }}>{status}</span>
  );
}

function StatusIconCell(props: RTCell<Trigger>, highlightNewerThan?: string) {
  const status = props.value === '0' ? 'ok' : 'problem';
  let newProblem = false;
  if (highlightNewerThan) {
    newProblem = isNewProblem(props.original, highlightNewerThan);
  }
  const className = classNames('zbx-problem-status-icon',
    { 'problem-status--new': newProblem },
    { 'zbx-problem': props.value === '1' },
    { 'zbx-ok': props.value === '0' },
  );
  return <GFHeartIcon status={status} className={className} />;
}

function GroupCell(props: RTCell<Trigger>) {
  let groups = "";
  if (props.value && props.value.length) {
    groups = props.value.map(g => g.name).join(', ');
  }
  return (
    <span>{groups}</span>
  );
}

function ProblemCell(props: RTCell<Trigger>) {
  const comments = props.original.comments;
  return (
    <div>
      <span className="problem-description">{props.value}</span>
      {/* {comments && <FAIcon icon="file-text-o" customClass="comments-icon" />} */}
    </div>
  );
}

interface TagCellProps extends RTCell<Trigger> {
  onTagClick: (tag: ZBXTag, datasource: string) => void;
}

class TagCell extends PureComponent<TagCellProps> {
  handleTagClick = (tag: ZBXTag) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, this.props.original.datasource);
    }
  }

  render() {
    const tags = this.props.value || [];
    return [
      tags.map(tag => <EventTag key={tag.tag + tag.value} tag={tag} onClick={this.handleTagClick} /> )
    ];
  }
}

function CustomExpander(props: RTCell<any>) {
  return (
    <span className={props.isExpanded ? "expanded" : ""}>
      <i className="fa fa-info-circle"></i>
    </span>
  );
}

function isNewProblem(problem: Trigger, highlightNewerThan: string): boolean {
  try {
    const highlightIntervalMs = utils.parseInterval(highlightNewerThan);
    const durationSec = (Date.now() - problem.lastchangeUnix * 1000);
    return durationSec < highlightIntervalMs;
  } catch (e) {
    return false;
  }
}